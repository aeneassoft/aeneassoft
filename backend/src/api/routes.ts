// [PRODUCTNAME] Backend API Routes
import { FastifyInstance } from 'fastify';
import {
  queryTraces,
  queryTraceSpans,
  queryMetrics,
  insertSpan,
  queryCausalLinks,
} from '../db/clickhouse';
import { CausalGraphEngine } from '../engine/causal-graph';
import { calculateGraphCost, costBreakdownByAgent } from '../engine/cost-attribution';
import { ATPSpanSchema } from '@productname/atp-schema';
import { assertHexId } from '../db/clickhouse';
import { calculateComplianceScore } from '../compliance/score';

const TRACE_ID_RE = /^[0-9a-f]{32}$/;
function isValidTraceId(id: string): boolean { return TRACE_ID_RE.test(id); }

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    product: '[PRODUCTNAME]',
    timestamp: new Date().toISOString(),
  }));

  // GET /api/traces — Last 50 root spans
  fastify.get('/api/traces', async (request, reply) => {
    try {
      const traces = await queryTraces(CLICKHOUSE_URL, 50);
      return reply.send({ traces });
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to query traces');
      return reply.status(500).send({ error: 'Failed to query traces', details: err.message });
    }
  });

  // GET /api/traces/:trace_id/graph — Causal graph (nodes + edges + costs)
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
      return reply.status(500).send({ error: 'Failed to build graph', details: err.message });
    }
  });

  // GET /api/traces/:trace_id/spans — All spans for a trace
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

  // GET /api/metrics — KPIs (total traces, error rate, cost, latency)
  fastify.get('/api/metrics', async (request, reply) => {
    try {
      const metrics = await queryMetrics(CLICKHOUSE_URL);
      return reply.send({ ...metrics, period: '24h' });
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to query metrics');
      return reply.status(500).send({ error: 'Failed to query metrics' });
    }
  });

  // POST /api/ingest — Direct span ingestion (alternative to proxy)
  fastify.post('/api/ingest', async (request, reply) => {
    try {
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

  // GET /api/traces/:trace_id/compliance-score — EU AI Act Readiness Score (0-100)
  fastify.get<{ Params: { trace_id: string } }>('/api/traces/:trace_id/compliance-score', async (request, reply) => {
    try {
      const { trace_id } = request.params;
      if (!isValidTraceId(trace_id)) return reply.status(400).send({ error: 'Invalid trace_id format' });
      const spans = await queryTraceSpans(CLICKHOUSE_URL, trace_id);
      return reply.send(calculateComplianceScore(trace_id, spans));
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Failed to calculate compliance score');
      return reply.status(500).send({ error: 'Failed to calculate compliance score', details: err.message });
    }
  });

  // GET /api/traces/:trace_id/compliance-report — PDF download
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
      return reply.status(500).send({ error: 'Failed to generate compliance report', details: err.message });
    }
  });
}
