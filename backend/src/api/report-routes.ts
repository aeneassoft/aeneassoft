// AeneasSoft Report Routes — Monthly reports, CSV, PDF, ZIP exports
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

const VALID_MONTH = /^\d{4}-\d{2}$/;

function getCurrentMonth(): string {
  return new Date().toISOString().substring(0, 7); // "2026-03"
}

function getMonthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number);
  const from = `${year}-${String(m).padStart(2, '0')}-01`;
  const nextMonth = m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, '0')}-01`;
  return { from, to: nextMonth };
}

async function chQuery(url: string, query: string): Promise<any[]> {
  const db = process.env.CLICKHOUSE_DB || 'aeneassoft';
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data || [];
}

export async function registerReportRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/reports/monthly — aggregated monthly report data
  fastify.get('/api/reports/monthly', async (request: FastifyRequest, reply: FastifyReply) => {
    const { month } = request.query as { month?: string };
    const period = month && VALID_MONTH.test(month) ? month : getCurrentMonth();
    const { from, to } = getMonthRange(period);
    const orgId = request.orgId || 'default';

    const [summary, byAgent, byModel, topErrors, traces] = await Promise.all([
      chQuery(CLICKHOUSE_URL, `
        SELECT
          countDistinct(trace_id) AS total_traces,
          sum(accumulated_cost_usd) AS total_cost_usd,
          countIf(status_code = 'ERROR') / greatest(count(), 1) AS error_rate,
          avg(latency_ms) AS avg_latency_ms,
          sum(prompt_tokens + completion_tokens) AS total_tokens
        FROM agent_spans
        WHERE start_time >= '${from}' AND start_time < '${to}'
          AND org_id = '${orgId}'
        FORMAT JSON
      `),
      chQuery(CLICKHOUSE_URL, `
        SELECT
          agent_id, agent_name,
          countDistinct(trace_id) AS trace_count,
          sum(accumulated_cost_usd) AS total_cost_usd,
          countIf(status_code = 'ERROR') / greatest(count(), 1) AS error_rate
        FROM agent_spans
        WHERE start_time >= '${from}' AND start_time < '${to}'
          AND org_id = '${orgId}'
        GROUP BY agent_id, agent_name
        ORDER BY total_cost_usd DESC
        LIMIT 20
        FORMAT JSON
      `),
      chQuery(CLICKHOUSE_URL, `
        SELECT
          model_name AS model,
          countDistinct(trace_id) AS trace_count,
          sum(accumulated_cost_usd) AS total_cost_usd,
          sum(prompt_tokens + completion_tokens) AS total_tokens
        FROM agent_spans
        WHERE start_time >= '${from}' AND start_time < '${to}'
          AND org_id = '${orgId}'
          AND model_name != ''
        GROUP BY model_name
        ORDER BY total_cost_usd DESC
        LIMIT 20
        FORMAT JSON
      `),
      chQuery(CLICKHOUSE_URL, `
        SELECT
          status_message AS error_type,
          count() AS count,
          max(start_time) AS last_seen
        FROM agent_spans
        WHERE start_time >= '${from}' AND start_time < '${to}'
          AND org_id = '${orgId}'
          AND status_code = 'ERROR'
          AND status_message != ''
        GROUP BY status_message
        ORDER BY count DESC
        LIMIT 10
        FORMAT JSON
      `),
      chQuery(CLICKHOUSE_URL, `
        SELECT
          trace_id, name, status_code AS status,
          accumulated_cost_usd AS cost_usd,
          latency_ms, start_time AS created_at
        FROM agent_spans
        WHERE start_time >= '${from}' AND start_time < '${to}'
          AND org_id = '${orgId}'
          AND parent_span_id = ''
        ORDER BY start_time DESC
        LIMIT 200
        FORMAT JSON
      `),
    ]);

    const s = summary[0] || {};

    return reply.send({
      period,
      summary: {
        total_traces: Number(s.total_traces) || 0,
        total_cost_usd: Number(s.total_cost_usd) || 0,
        error_rate: Number(s.error_rate) || 0,
        avg_latency_ms: Number(s.avg_latency_ms) || 0,
        total_tokens: Number(s.total_tokens) || 0,
      },
      by_agent: byAgent.map((a: any) => ({
        agent_id: a.agent_id,
        agent_name: a.agent_name,
        trace_count: Number(a.trace_count),
        total_cost_usd: Number(a.total_cost_usd),
        error_rate: Number(a.error_rate),
      })),
      by_model: byModel.map((m: any) => ({
        model: m.model,
        trace_count: Number(m.trace_count),
        total_cost_usd: Number(m.total_cost_usd),
        total_tokens: Number(m.total_tokens),
      })),
      top_errors: topErrors.map((e: any) => ({
        error_type: e.error_type,
        count: Number(e.count),
        last_seen: e.last_seen,
      })),
      traces: traces.map((t: any) => ({
        trace_id: t.trace_id,
        name: t.name,
        status: t.status,
        cost_usd: Number(t.cost_usd),
        latency_ms: Number(t.latency_ms),
        created_at: t.created_at,
      })),
    });
  });

  // GET /api/reports/monthly/csv — CSV export
  fastify.get('/api/reports/monthly/csv', async (request: FastifyRequest, reply: FastifyReply) => {
    const { month } = request.query as { month?: string };
    const period = month && VALID_MONTH.test(month) ? month : getCurrentMonth();
    const { from, to } = getMonthRange(period);
    const orgId = request.orgId || 'default';

    const rows = await chQuery(CLICKHOUSE_URL, `
      SELECT
        start_time AS date,
        trace_id,
        agent_name,
        model_name AS model,
        status_code AS status,
        prompt_tokens + completion_tokens AS tokens,
        accumulated_cost_usd AS cost_usd,
        latency_ms
      FROM agent_spans
      WHERE start_time >= '${from}' AND start_time < '${to}'
        AND org_id = '${orgId}'
      ORDER BY start_time ASC
      FORMAT JSON
    `);

    const header = 'date,trace_id,agent_name,model,status,tokens,cost_usd,latency_ms';
    const csvRows = rows.map((r: any) =>
      `${r.date},${r.trace_id},${esc(r.agent_name)},${esc(r.model)},${r.status},${r.tokens},${r.cost_usd},${r.latency_ms}`
    );
    const csv = [header, ...csvRows].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="aeneassoft-traces-${period}.csv"`);
    return reply.send(csv);
  });

  // GET /api/reports/monthly/pdf — Monthly PDF report
  fastify.get('/api/reports/monthly/pdf', async (request: FastifyRequest, reply: FastifyReply) => {
    const { month } = request.query as { month?: string };
    const period = month && VALID_MONTH.test(month) ? month : getCurrentMonth();
    const { from, to } = getMonthRange(period);
    const orgId = request.orgId || 'default';

    // Fetch the monthly data inline (reuse logic)
    const res = await fastify.inject({
      method: 'GET',
      url: `/api/reports/monthly?month=${period}`,
      headers: request.headers as Record<string, string>,
    });
    const data = JSON.parse(res.body);

    const { generateMonthlyReport } = await import('../compliance/monthly-report');
    const pdfBuffer = await generateMonthlyReport(period, data, orgId);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="aeneassoft-report-${period}.pdf"`);
    return reply.send(pdfBuffer);
  });

  // GET /api/reports/monthly/zip — ZIP with PDF + CSV + JSON
  fastify.get('/api/reports/monthly/zip', async (request: FastifyRequest, reply: FastifyReply) => {
    const { month } = request.query as { month?: string };
    const period = month && VALID_MONTH.test(month) ? month : getCurrentMonth();

    const [dataRes, csvRes, pdfRes] = await Promise.all([
      fastify.inject({ method: 'GET', url: `/api/reports/monthly?month=${period}`, headers: request.headers as Record<string, string> }),
      fastify.inject({ method: 'GET', url: `/api/reports/monthly/csv?month=${period}`, headers: request.headers as Record<string, string> }),
      fastify.inject({ method: 'GET', url: `/api/reports/monthly/pdf?month=${period}`, headers: request.headers as Record<string, string> }),
    ]);

    const archiver = (await import('archiver')).default;
    const chunks: Buffer[] = [];

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });

    archive.append(dataRes.body, { name: `traces-${period}.json` });
    archive.append(csvRes.body, { name: `traces-${period}.csv` });
    archive.append(pdfRes.rawPayload, { name: `monthly-report-${period}.pdf` });
    archive.finalize();

    const zipBuffer = await done;

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="aeneassoft-export-${period}.zip"`);
    return reply.send(zipBuffer);
  });
}

function esc(val: string): string {
  if (!val) return '';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
