// [PRODUCTNAME] Alert Routes — CRUD for alert rules + history
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import {
  getAlertRules,
  getAlertRuleById,
  createAlertRule,
  deleteAlertRule,
  getAlertHistory,
  updateAlertIsActive,
  findUserById,
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
}
