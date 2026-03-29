// [PRODUCTNAME] Backend API Routes
import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import {
  queryTraces,
  queryTraceSpans,
  queryMetrics,
  insertSpan,
  queryCausalLinks,
  createApiKey,
  listApiKeys,
  deleteApiKey,
  countApiKeys,
  queryCostDaily,
  queryCostByAgent,
  queryCostByModel,
  queryBillingUsage,
  findUserByOrgId,
  TraceQueryParams,
} from '../db/clickhouse';
import { CausalGraphEngine } from '../engine/causal-graph';
import { calculateGraphCost, costBreakdownByAgent } from '../engine/cost-attribution';
import { ATPSpanSchema } from '@productname/atp-schema';
import { assertHexId } from '../db/clickhouse';
import { calculateComplianceScore } from '../compliance/score';
import { sendContactEmail } from '../emails';

const TRACE_ID_RE = /^[0-9a-f]{32}$/;
function isValidTraceId(id: string): boolean { return TRACE_ID_RE.test(id); }

const PLAN_LIMITS: Record<string, number | null> = {
  free: 10_000,
  pro: 100_000,
  enterprise: null, // unlimited
};

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check (no auth)
  fastify.get('/health', async () => ({
    status: 'ok',
    product: '[PRODUCTNAME]',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  // ── Traces ─────────────────────────────────────────────────────────────────

  // GET /api/traces — returns Trace[] array (frontend-compatible format)
  fastify.get('/api/traces', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>;
      const params: TraceQueryParams = {
        limit: q.limit ? parseInt(q.limit, 10) : 50,
        offset: q.offset ? parseInt(q.offset, 10) : 0,
        status: q.status,
        agent_id: q.agent_id,
        model: q.model,
        from: q.from,
        to: q.to,
      };
      const { traces } = await queryTraces(CLICKHOUSE_URL, params.limit, params);
      // Transform to frontend Trace shape
      const result = traces.map((t: any) => ({
        id: t.trace_id,
        name: t.name,
        status: t.status_code === 'ERROR' ? 'error' : t.status_code === 'OK' ? 'ok' : 'running',
        tokens: (Number(t.prompt_tokens) || 0) + (Number(t.completion_tokens) || 0),
        cost: Number(t.accumulated_cost_usd) || 0,
        latency: (Number(t.latency_ms) || 0) / 1000,
        model: t.model_name || null,
        createdAt: t.start_time,
        span_count: t.span_count,
      }));
      return reply.send(result);
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to query traces');
      return reply.status(500).send({ error: 'Failed to query traces' });
    }
  });

  // GET /api/traces/:trace_id/graph — causal graph
  fastify.get<{ Params: { trace_id: string } }>('/api/traces/:trace_id/graph', async (request, reply) => {
    try {
      const { trace_id } = request.params;
      if (!isValidTraceId(trace_id)) return reply.status(400).send({ error: 'Invalid trace_id format' });
      const spans = await queryTraceSpans(CLICKHOUSE_URL, trace_id);
      const links = await queryCausalLinks(CLICKHOUSE_URL, trace_id);

      for (const link of links) {
        const targetSpan = spans.find((s: any) => s.span_id === link.target_span);
        if (targetSpan) {
          if (!targetSpan.links) targetSpan.links = [];
          targetSpan.links.push({
            trace_id: link.trace_id,
            span_id: link.source_span,
            link_type: link.link_type,
          });
        }
      }

      const engine = new CausalGraphEngine();
      const graph = engine.buildFromSpans(spans);
      return reply.send({
        ...graph,
        totalCost: calculateGraphCost(spans),
        costByAgent: costBreakdownByAgent(spans),
        spanCount: spans.length,
      });
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to build graph');
      return reply.status(500).send({ error: 'Failed to build graph' });
    }
  });

  // GET /api/traces/:trace_id/spans
  fastify.get<{ Params: { trace_id: string } }>('/api/traces/:trace_id/spans', async (request, reply) => {
    try {
      const { trace_id } = request.params;
      if (!isValidTraceId(trace_id)) return reply.status(400).send({ error: 'Invalid trace_id format' });
      const spans = await queryTraceSpans(CLICKHOUSE_URL, trace_id);
      return reply.send({ spans });
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to query spans');
      return reply.status(500).send({ error: 'Failed to query spans' });
    }
  });

  // ── Metrics ────────────────────────────────────────────────────────────────

  // GET /api/metrics — KPIs
  fastify.get('/api/metrics', async (request, reply) => {
    try {
      const m = await queryMetrics(CLICKHOUSE_URL);
      return reply.send({
        totalTraces: Number(m.total_traces) || 0,
        totalTokens: Number(m.total_tokens) || 0,
        totalCost: Number(m.total_cost_usd) || 0,
        avgLatency: (Number(m.avg_latency_ms) || 0) / 1000,
        tracesThisMonth: Number(m.traces_this_month) || 0,
        errorRate: Number(m.error_rate) || 0,
        period: '24h',
      });
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to query metrics');
      return reply.status(500).send({ error: 'Failed to query metrics' });
    }
  });

  // ── Cost (FinOps) ──────────────────────────────────────────────────────────

  // GET /api/cost/daily — daily cost rollup
  fastify.get('/api/cost/daily', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>;
      const data = await queryCostDaily(CLICKHOUSE_URL, q.from, q.to);
      return reply.send({ cost: data });
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to query daily cost');
      return reply.status(500).send({ error: 'Failed to query daily cost' });
    }
  });

  // GET /api/cost/by-agent — cost breakdown per agent
  fastify.get('/api/cost/by-agent', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>;
      const data = await queryCostByAgent(CLICKHOUSE_URL, q.from, q.to);
      return reply.send({ cost: data });
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to query agent cost');
      return reply.status(500).send({ error: 'Failed to query agent cost' });
    }
  });

  // GET /api/cost/by-model — cost breakdown per model
  fastify.get('/api/cost/by-model', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>;
      const data = await queryCostByModel(CLICKHOUSE_URL, q.from, q.to);
      return reply.send({ cost: data });
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to query model cost');
      return reply.status(500).send({ error: 'Failed to query model cost' });
    }
  });

  // ── Ingest ─────────────────────────────────────────────────────────────────

  // POST /api/ingest — direct span ingestion
  fastify.post('/api/ingest', async (request, reply) => {
    try {
      // ── Plan limit check ────────────────────────────────────────────────────
      const orgId = request.orgId;
      if (orgId && orgId !== 'default') {
        const user = await findUserByOrgId(CLICKHOUSE_URL, orgId);
        const plan = user?.plan || 'free';
        const limit = plan in PLAN_LIMITS ? PLAN_LIMITS[plan] : PLAN_LIMITS.free;
        if (limit !== null) {
          const usage = await queryBillingUsage(CLICKHOUSE_URL, orgId);
          if (usage.traces_this_month >= limit) {
            return reply.status(429).send({
              error: 'Monthly trace limit reached',
              plan,
              limit,
              usage: usage.traces_this_month,
              upgrade_url: 'https://aeneassoft.com/pricing',
            });
          }
        }
      }

      const parsed = ATPSpanSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid ATP span',
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const span = parsed.data;
      await insertSpan(CLICKHOUSE_URL, span);

      if (span.links) {
        const db = process.env.CLICKHOUSE_DB || 'productname';
        for (const link of span.links) {
          const query = `INSERT INTO agent_causal_links (trace_id, source_span, target_span, link_type) VALUES ('${span.trace_id}', '${link.span_id}', '${span.span_id}', '${link.link_type}')`;
          await fetch(`${CLICKHOUSE_URL}/?database=${db}`, { method: 'POST', body: query });
        }
      }

      return reply.status(202).send({ accepted: true });
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to ingest span');
      return reply.status(500).send({ error: 'Failed to ingest span' });
    }
  });

  // ── Compliance ─────────────────────────────────────────────────────────────

  // GET /api/traces/:trace_id/compliance-score
  fastify.get<{ Params: { trace_id: string } }>('/api/traces/:trace_id/compliance-score', async (request, reply) => {
    try {
      const { trace_id } = request.params;
      if (!isValidTraceId(trace_id)) return reply.status(400).send({ error: 'Invalid trace_id format' });
      const spans = await queryTraceSpans(CLICKHOUSE_URL, trace_id);
      return reply.send(calculateComplianceScore(trace_id, spans));
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to calculate compliance score');
      return reply.status(500).send({ error: 'Failed to calculate compliance score' });
    }
  });

  // GET /api/traces/:trace_id/compliance-report — signed PDF
  fastify.get<{ Params: { trace_id: string } }>('/api/traces/:trace_id/compliance-report', async (request, reply) => {
    try {
      const { trace_id } = request.params;
      if (!isValidTraceId(trace_id)) return reply.status(400).send({ error: 'Invalid trace_id format' });
      const spans = await queryTraceSpans(CLICKHOUSE_URL, trace_id);
      const { generateComplianceReport } = await import('../compliance/exporter');
      const pdfBuffer = await generateComplianceReport(trace_id, spans);
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="compliance-report-${trace_id.substring(0, 8)}.pdf"`);
      return reply.send(pdfBuffer);
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to generate compliance report');
      return reply.status(500).send({ error: 'Failed to generate compliance report' });
    }
  });

  // ── API Key Management ─────────────────────────────────────────────────────

  // POST /api/keys — create a new API key for an org
  fastify.post('/api/keys', async (request, reply) => {
    try {
      const body = request.body as { org_id?: string; label?: string };
      const orgId = body.org_id || request.orgId || 'default';
      const label = body.label || '';
      const rawKey = `aw_${randomBytes(32).toString('hex')}`;
      await createApiKey(CLICKHOUSE_URL, rawKey, orgId, label);

      // Import createHash to compute key_hash for id
      const { createHash } = await import('crypto');
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const prefix = `aw_...${keyHash.substring(0, 8)}`;

      return reply.status(201).send({
        key: rawKey,
        id: keyHash,
        label,
        prefix,
        createdAt: new Date().toISOString(),
        message: 'Store this key securely — it cannot be retrieved again.',
      });
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to create API key');
      return reply.status(500).send({ error: 'Failed to create API key' });
    }
  });

  // DELETE /api/keys/:id — delete API key (id = key_hash)
  fastify.delete<{ Params: { id: string } }>('/api/keys/:id', async (request, reply) => {
    try {
      const orgId = request.orgId || 'default';
      const { id } = request.params;

      // Validate key_hash format (SHA-256 hex = 64 chars)
      const KEY_HASH_RE = /^[0-9a-f]{64}$/;
      if (!KEY_HASH_RE.test(id)) {
        return reply.status(400).send({ error: 'Invalid key id format' });
      }

      // Prevent deleting the last key
      const count = await countApiKeys(CLICKHOUSE_URL, orgId);
      if (count <= 1) {
        return reply.status(400).send({ error: 'Cannot delete the last API key. Create a new key first.' });
      }

      await deleteApiKey(CLICKHOUSE_URL, id, orgId);
      return reply.send({ success: true, id });
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to delete API key');
      return reply.status(500).send({ error: 'Failed to delete API key' });
    }
  });

  // GET /api/keys — list API keys for current org (hashes only)
  // POST /api/contact — send contact/sales/investor email
  fastify.post('/api/contact', async (request, reply) => {
    const { name, email, company, message, type } = request.body as {
      name?: string; email?: string; company?: string; message?: string; type?: string;
    };
    if (!name || !email || !message) {
      return reply.status(400).send({ error: 'Name, email, and message required' });
    }
    await sendContactEmail(name, email, company || '', message, type || 'contact');
    return reply.send({ message: 'Message sent. We will respond within 24 hours.' });
  });

  fastify.get('/api/keys', async (request, reply) => {
    try {
      const orgId = request.orgId || 'default';
      const keys = await listApiKeys(CLICKHOUSE_URL, orgId);
      // Return array directly (frontend expects ApiKey[])
      return reply.send(keys.map((k: any) => ({
        id: k.key_hash,
        prefix: `aw_...${k.key_hash.substring(0, 8)}`,
        label: k.label,
        createdAt: k.created_at,
      })));
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to list API keys');
      return reply.status(500).send({ error: 'Failed to list API keys' });
    }
  });
}
