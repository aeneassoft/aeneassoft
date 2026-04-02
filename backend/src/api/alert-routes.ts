// AeneasSoft Alert Routes — CRUD for alert rules + history
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import {
  getAlertRules,
  getAlertRuleById,
  createAlertRule,
  deleteAlertRule,
  getAlertHistory,
  saveAlertHistory,
  updateAlertIsActive,
  findUserById,
  queryBillingUsage,
  queryHourlyCBStatus,
  getCBState,
  setCBState,
} from '../db/clickhouse';

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

const UUID_RE = /^[0-9a-f-]{36}$/;

// Transform DB rule → frontend AlertRule shape
function toAlertRule(r: any) {
  return {
    id: r.id,
    name: r.name,
    condition: r.trigger_type,   // trigger_type → condition
    threshold: Number(r.threshold),
    enabled: r.is_active === 1 || r.is_active === '1', // is_active → enabled (bool)
    createdAt: r.created_at,
  };
}

// Transform DB history → frontend AlertEvent shape
function toAlertEvent(h: any) {
  return {
    id: h.id,
    ruleId: h.rule_id,
    ruleName: h.rule_name || '(deleted)',
    triggeredAt: h.triggered_at,
    value: Number(h.value),
    message: h.message,
  };
}

export async function registerAlertRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/alerts — list alert rules (returns AlertRule[] array)
  fastify.get('/api/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    const rules = await getAlertRules(CLICKHOUSE_URL, orgId);
    return reply.send(rules.map(toAlertRule));
  });

  // POST /api/alerts — create alert rule
  // Frontend sends: { name, condition, threshold }
  fastify.post('/api/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    const body = request.body as {
      name?: string;
      condition?: string;       // frontend field name
      trigger_type?: string;    // legacy field name (passthrough)
      threshold?: number;
      time_window_minutes?: number;
      action_type?: string;
      action_target?: string;
    };

    if (!body.name || body.threshold == null) {
      return reply.status(400).send({ error: 'Missing required fields: name, threshold' });
    }

    const trigger_type = body.condition || body.trigger_type || 'error_rate';

    // Default action_target to user's email if JWT auth available
    let actionTarget = body.action_target || '';
    if (!actionTarget && request.userId) {
      const user = await findUserById(CLICKHOUSE_URL, request.userId);
      actionTarget = user?.email || '';
    }

    const rule = {
      id: randomUUID(),
      org_id: orgId,
      name: body.name,
      trigger_type,
      threshold: body.threshold,
      time_window_minutes: body.time_window_minutes || 60,
      action_type: body.action_type || 'email',
      action_target: actionTarget,
      is_active: 1,
    };

    await createAlertRule(CLICKHOUSE_URL, rule);
    return reply.status(201).send(toAlertRule({ ...rule, created_at: new Date().toISOString() }));
  });

  // DELETE /api/alerts/:id — delete alert rule
  fastify.delete<{ Params: { id: string } }>('/api/alerts/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    await deleteAlertRule(CLICKHOUSE_URL, request.params.id, orgId);
    return reply.send({ deleted: true });
  });

  // PATCH /api/alerts/:id — toggle enabled/disabled
  // Frontend sends: { enabled: true/false }
  fastify.patch<{ Params: { id: string } }>('/api/alerts/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    const { id } = request.params;

    if (!UUID_RE.test(id)) {
      return reply.status(400).send({ error: 'Invalid alert id format' });
    }

    const body = request.body as { enabled?: unknown; is_active?: unknown };

    // Accept either `enabled` (boolean, frontend) or `is_active` (0/1, legacy)
    let is_active: 0 | 1;
    if (body.enabled !== undefined) {
      is_active = body.enabled ? 1 : 0;
    } else if (body.is_active === 0 || body.is_active === 1) {
      is_active = body.is_active as 0 | 1;
    } else {
      return reply.status(400).send({ error: 'enabled (boolean) or is_active (0/1) required' });
    }

    await updateAlertIsActive(CLICKHOUSE_URL, id, orgId, is_active);

    // Fetch updated rule and return full AlertRule shape
    const updated = await getAlertRuleById(CLICKHOUSE_URL, id, orgId);
    if (!updated) {
      // Rule updated but not found (ClickHouse eventual consistency) — return synthetic response
      return reply.send({ id, enabled: is_active === 1, condition: '', threshold: 0, name: '', createdAt: '' });
    }
    return reply.send(toAlertRule(updated));
  });

  // GET /api/alerts/history — alert history (returns AlertEvent[] array)
  fastify.get('/api/alerts/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    const history = await getAlertHistory(CLICKHOUSE_URL, orgId);
    return reply.send(history.map(toAlertEvent));
  });

  // POST /api/alerts/sdk-alert — receive alert from SDK (API key auth)
  fastify.post('/api/alerts/sdk-alert', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    const body = request.body as {
      scope?: string;
      scope_id?: string;
      reason?: string;
      threshold?: number;
      current?: number;
      blocked?: boolean;
      timestamp?: number;
    };

    if (!body.reason) {
      return reply.status(400).send({ error: 'Missing reason' });
    }

    await saveAlertHistory(CLICKHOUSE_URL, {
      id: randomUUID(),
      rule_id: `sdk-${body.scope || 'global'}`,
      rule_name: `Active Defense: ${body.scope || 'global'}/${body.scope_id || 'default'}`,
      org_id: orgId,
      value: body.current || 0,
      message: `${body.reason} (threshold: ${body.threshold}, current: ${body.current?.toFixed(2)}, blocked: ${body.blocked})`,
    });

    fastify.log.warn(
      `AeneasSoft SDK Alert [${body.scope}:${body.scope_id}]: ${body.reason} ` +
      `(threshold: ${body.threshold}, current: ${body.current}, blocked: ${body.blocked})`
    );

    return reply.send({ received: true });
  });

  // GET /api/circuit-breaker/status — real-time circuit breaker state
  fastify.get('/api/circuit-breaker/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';

    const [rules, live] = await Promise.all([
      getAlertRules(CLICKHOUSE_URL, orgId),
      queryHourlyCBStatus(CLICKHOUSE_URL, orgId),
    ]);

    // Extract thresholds from user-configured rules
    const budgetRule = rules.find((r: any) => r.trigger_type === 'cost_per_hour');
    const errorRule = rules.find((r: any) => r.trigger_type === 'error_rate');

    const budgetLimit = budgetRule ? Number(budgetRule.threshold) : null;
    const errorLimit = errorRule ? Number(errorRule.threshold) : null;
    const budgetExceeded = budgetLimit !== null && live.hour_cost >= budgetLimit;
    const errorExceeded = errorLimit !== null && live.error_rate >= errorLimit;

    // Merge server-side CB state (dashboard controls)
    const cbState = await getCBState(CLICKHOUSE_URL, orgId);
    const budgetWithOverride = budgetLimit !== null && cbState.budget_override
      ? budgetLimit + cbState.budget_override : budgetLimit;

    // Determine status — CB state overrides rule-based status
    let status: string;
    if (cbState.state === 'paused') {
      const pausedUntil = cbState.paused_until ? new Date(cbState.paused_until).getTime() : 0;
      status = pausedUntil > Date.now() ? 'paused' : 'half_open';
    } else {
      const hasRules = budgetLimit !== null || errorLimit !== null;
      const anyBlocking = rules.some((r: any) => (r.is_active === 1 || r.is_active === '1'));
      status = !hasRules ? 'disabled' : anyBlocking ? 'armed' : 'alert_only';
    }

    // Count blocked alerts from history
    const history = await getAlertHistory(CLICKHOUSE_URL, orgId, 200);
    const blockedAlerts = history.filter((h: any) => h.message?.includes('blocked: true'));

    const effectiveBudget = budgetWithOverride;
    return reply.send({
      status,
      paused_until: cbState.state === 'paused' ? cbState.paused_until : null,
      budget_override: cbState.budget_override,
      budget: {
        current_hour_cost: Math.round(live.hour_cost * 10000) / 10000,
        limit: effectiveBudget,
        remaining: effectiveBudget !== null ? Math.round((effectiveBudget - live.hour_cost) * 10000) / 10000 : null,
        exceeded: effectiveBudget !== null && live.hour_cost >= effectiveBudget,
      },
      error_rate: {
        current_rate: Math.round(live.error_rate * 10000) / 10000,
        window_calls: live.error_window_calls,
        limit: errorLimit,
        exceeded: errorExceeded,
      },
      call_rate: {
        current_minute: live.calls_per_minute,
      },
      by_agent: live.by_agent,
      blocked: {
        count: blockedAlerts.length,
        estimated_savings: Math.round(blockedAlerts.reduce((sum: number, h: any) => sum + (Number(h.value) || 0), 0) * 100) / 100,
      },
    });
  });

  // ── Circuit Breaker Controls ──────────────────────────────────────────────

  // POST /api/circuit-breaker/pause
  fastify.post('/api/circuit-breaker/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    const { seconds = 60, reason = 'Manual pause from dashboard' } = request.body as { seconds?: number; reason?: string };
    const pauseSeconds = Math.min(Math.max(seconds, 10), 86400); // 10s to 24h
    const pausedUntil = new Date(Date.now() + pauseSeconds * 1000).toISOString().replace('T', ' ').substring(0, 19);

    await setCBState(CLICKHOUSE_URL, orgId, 'paused', pausedUntil, null, reason, request.userId || 'dashboard');

    await saveAlertHistory(CLICKHOUSE_URL, {
      id: randomUUID(),
      rule_id: 'circuit-breaker-control',
      rule_name: 'Circuit Breaker Paused',
      org_id: orgId,
      value: pauseSeconds,
      message: `circuit_breaker_paused: ${reason} (${pauseSeconds}s)`,
    });

    return reply.send({ status: 'paused', paused_until: pausedUntil, seconds: pauseSeconds });
  });

  // POST /api/circuit-breaker/resume
  fastify.post('/api/circuit-breaker/resume', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    const { reason = 'Manual resume from dashboard' } = request.body as { reason?: string };

    await setCBState(CLICKHOUSE_URL, orgId, 'closed', null, null, reason, request.userId || 'dashboard');

    await saveAlertHistory(CLICKHOUSE_URL, {
      id: randomUUID(),
      rule_id: 'circuit-breaker-control',
      rule_name: 'Circuit Breaker Resumed',
      org_id: orgId,
      value: 0,
      message: `circuit_breaker_recovered: ${reason}`,
    });

    return reply.send({ status: 'armed' });
  });

  // POST /api/circuit-breaker/override — increase budget
  fastify.post('/api/circuit-breaker/override', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    const { additional_budget = 5.0 } = request.body as { additional_budget?: number };
    const amount = Math.min(Math.max(additional_budget, 0.01), 10000); // $0.01 to $10,000

    // Get current override and add
    const current = await getCBState(CLICKHOUSE_URL, orgId);
    const newOverride = (current.budget_override || 0) + amount;

    await setCBState(CLICKHOUSE_URL, orgId, 'closed', null, newOverride, `Budget +$${amount}`, request.userId || 'dashboard');

    await saveAlertHistory(CLICKHOUSE_URL, {
      id: randomUUID(),
      rule_id: 'circuit-breaker-control',
      rule_name: 'Budget Override',
      org_id: orgId,
      value: amount,
      message: `budget_increased: +$${amount.toFixed(2)} (new override: $${newOverride.toFixed(2)})`,
    });

    return reply.send({ budget_override: newOverride, added: amount });
  });
}
