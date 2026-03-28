// [PRODUCTNAME] OpenClaw Skill
// Instruments OpenClaw agents with ATP observability.
// Install: copy this folder into your OpenClaw skills directory.

const BACKEND_URL = process.env.PRODUCTNAME_URL || 'http://localhost:3001';
const API_KEY = process.env.PRODUCTNAME_API_KEY || '';

// Active traces for this OpenClaw session
const activeTraces = new Map();

module.exports = {
  // ── start_trace ─────────────────────────────────────────────────────────────
  start_trace: async ({ name, agent_id = 'openclaw-agent' }) => {
    const traceId = crypto.randomUUID().replace(/-/g, '');
    const spanId = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    const now = Date.now();

    const rootSpan = {
      trace_id: traceId,
      span_id: spanId,
      name: name || 'openclaw.agent.run',
      kind: 'SERVER',
      start_time_unix_nano: now * 1_000_000,
      end_time_unix_nano: now * 1_000_000,
      status: { code: 'OK' },
      agent_id,
      agent_name: 'OpenClaw Agent',
      agent_role: 'Orchestrator',
      compliance_flags: ['eu_ai_act_art12_relevant'],
      attributes: { framework: 'OpenClaw', skill: '[PRODUCTNAME]' },
    };

    activeTraces.set(traceId, { rootSpan, spanId, startMs: now });

    await fetch(`${BACKEND_URL}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rootSpan),
    }).catch(() => {});

    return {
      trace_id: traceId,
      dashboard_url: `http://localhost:3000/traces/${traceId}`,
      message: `Trace started. Dashboard: http://localhost:3000/traces/${traceId}`,
    };
  },

  // ── end_trace ────────────────────────────────────────────────────────────────
  end_trace: async ({ trace_id }) => {
    const ctx = activeTraces.get(trace_id);
    if (!ctx) return { error: `No active trace with id ${trace_id}` };

    const endMs = Date.now();
    const updatedSpan = {
      ...ctx.rootSpan,
      end_time_unix_nano: endMs * 1_000_000,
    };

    await fetch(`${BACKEND_URL}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSpan),
    }).catch(() => {});

    activeTraces.delete(trace_id);

    const durationSec = ((endMs - ctx.startMs) / 1000).toFixed(1);
    return {
      trace_id,
      duration_sec: parseFloat(durationSec),
      dashboard_url: `http://localhost:3000/traces/${trace_id}`,
      message: `Trace ended (${durationSec}s). View: http://localhost:3000/traces/${trace_id}`,
    };
  },

  // ── get_trace_cost ───────────────────────────────────────────────────────────
  get_trace_cost: async ({ trace_id }) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/traces/${trace_id}/graph`);
      const data = await r.json();
      return {
        trace_id,
        total_cost_usd: data.totalCost ?? 0,
        span_count: data.spanCount ?? 0,
        cost_by_agent: data.costByAgent ?? {},
      };
    } catch (e) {
      return { error: String(e) };
    }
  },

  // ── compliance_report ────────────────────────────────────────────────────────
  compliance_report: async ({ trace_id }) => {
    const url = `${BACKEND_URL}/api/traces/${trace_id}/compliance-report`;
    return {
      download_url: url,
      message: `EU AI Act compliance PDF: ${url}`,
    };
  },
};
