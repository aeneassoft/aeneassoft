// [PRODUCTNAME] ClickHouse Schema for ATP Spans
// TTL based on DATA_RETENTION_DAYS (default: 30)

const retentionDays = process.env.DATA_RETENTION_DAYS || '30';

export const CREATE_SPANS_TABLE = `
CREATE TABLE IF NOT EXISTS agent_spans (
  trace_id       FixedString(32),
  span_id        FixedString(16),
  parent_span_id Nullable(FixedString(16)),
  name           String,
  kind           LowCardinality(String),
  start_time     DateTime64(3),
  end_time       DateTime64(3),
  duration_ms    UInt32 MATERIALIZED toUInt32(toUnixTimestamp64Milli(end_time) - toUnixTimestamp64Milli(start_time)),
  status_code    LowCardinality(String) DEFAULT 'UNSET',
  status_message Nullable(String),
  agent_id       String,
  agent_name     String,
  agent_role     LowCardinality(String),
  decision_reasoning Nullable(String),
  input          Nullable(String),
  output         Nullable(String),
  model_name     LowCardinality(Nullable(String)),
  provider       LowCardinality(Nullable(String)),
  prompt_tokens  Nullable(UInt32),
  completion_tokens Nullable(UInt32),
  latency_ms     Nullable(UInt32),
  task_id        Nullable(String),
  accumulated_cost_usd Nullable(Float64),
  compliance_flags Array(String),
  raw_span       String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(start_time)
ORDER BY (trace_id, start_time, span_id)
TTL toDateTime(start_time) + INTERVAL ${retentionDays} DAY
SETTINGS index_granularity = 8192;
`;

export const CREATE_CAUSAL_LINKS_TABLE = `
CREATE TABLE IF NOT EXISTS agent_causal_links (
  trace_id    FixedString(32),
  source_span FixedString(16),
  target_span FixedString(16),
  link_type   LowCardinality(String),
  created_at  DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (trace_id, source_span, target_span)
TTL created_at + INTERVAL ${retentionDays} DAY;
`;

export async function initClickHouse(url: string): Promise<void> {
  const db = process.env.CLICKHOUSE_DB || 'productname';

  // Create database
  await fetch(`${url}/?query=${encodeURIComponent(`CREATE DATABASE IF NOT EXISTS "${db}"`)}`);

  // Create tables
  await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: CREATE_SPANS_TABLE,
  });

  await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: CREATE_CAUSAL_LINKS_TABLE,
  });

  console.log(`[PRODUCTNAME] ClickHouse tables initialized (TTL: ${retentionDays} days)`);
}

// Single span insert — used by /api/ingest direct path
export async function insertSpan(url: string, span: any): Promise<void> {
  return insertSpanBatch(url, [span]);
}

// Serialize one span to a row object
function spanToRow(span: any, zdr: boolean): Record<string, any> {
  return {
    trace_id: span.trace_id,
    span_id: span.span_id,
    parent_span_id: span.parent_span_id || null,
    name: span.name,
    kind: span.kind,
    start_time: Math.floor(span.start_time_unix_nano / 1_000_000),
    end_time: Math.floor(span.end_time_unix_nano / 1_000_000),
    status_code: span.status?.code || 'UNSET',
    status_message: span.status?.message || null,
    agent_id: span.agent_id,
    agent_name: span.agent_name,
    agent_role: span.agent_role,
    decision_reasoning: zdr ? null : (span.decision_reasoning || null),
    input: zdr ? null : (span.input || null),
    output: zdr ? null : (span.output || null),
    model_name: span.model_inference?.model_name || null,
    provider: span.model_inference?.provider || null,
    prompt_tokens: span.model_inference?.prompt_tokens || null,
    completion_tokens: span.model_inference?.completion_tokens || null,
    latency_ms: span.model_inference?.latency_ms || null,
    task_id: span.cost_attribution?.task_id || null,
    accumulated_cost_usd: span.cost_attribution?.accumulated_cost_usd || null,
    compliance_flags: span.compliance_flags || [],
    raw_span: zdr ? '{}' : JSON.stringify(span),
  };
}

function serializeValue(v: any): string | number {
  if (v === null) return 'NULL';
  if (Array.isArray(v)) return `[${v.map((s) => `'${String(s).replace(/'/g, "\\'")}'`).join(',')}]`;
  if (typeof v === 'number') return v;
  return `'${String(v).replace(/'/g, "\\'")}'`;
}

// Batch insert — one HTTP request for N spans (high-throughput path)
export async function insertSpanBatch(url: string, spans: any[]): Promise<void> {
  if (spans.length === 0) return;
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const zdr = process.env.ZERO_DATA_RETENTION === 'true';

  const rows = spans.map((s) => spanToRow(s, zdr));
  const columns = Object.keys(rows[0]).join(', ');
  const valueRows = rows
    .map((row) => `(${Object.values(row).map(serializeValue).join(', ')})`)
    .join(',\n');

  const query = `INSERT INTO agent_spans (${columns}) VALUES ${valueRows}`;

  await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: query,
  });
}

export async function queryTraces(url: string, limit = 50): Promise<any[]> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const query = `
    SELECT *
    FROM agent_spans
    WHERE parent_span_id IS NULL
    ORDER BY start_time DESC
    LIMIT ${limit}
    FORMAT JSON
  `;

  const res = await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: query,
  });

  const data = (await res.json()) as any;
  return data.data || [];
}

// Strict allowlist: only [0-9a-f]{32} permitted as trace/span IDs
export function assertHexId(value: string, len: 32 | 16): string {
  const re = len === 32 ? /^[0-9a-f]{32}$/ : /^[0-9a-f]{16}$/;
  if (!re.test(value)) throw new Error(`Invalid ID format: ${value}`);
  return value;
}

export async function queryTraceSpans(url: string, traceId: string): Promise<any[]> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const safeId = assertHexId(traceId, 32);   // throws if not hex32
  const query = `
    SELECT *
    FROM agent_spans
    WHERE trace_id = '${safeId}'
    ORDER BY start_time ASC
    FORMAT JSON
  `;

  const res = await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: query,
  });

  const data = (await res.json()) as any;
  return data.data || [];
}

export async function queryCausalLinks(url: string, traceId: string): Promise<any[]> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const safeId = assertHexId(traceId, 32);
  const query = `
    SELECT *
    FROM agent_causal_links
    WHERE trace_id = '${safeId}'
    FORMAT JSON
  `;

  const res = await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: query,
  });

  const data = (await res.json()) as any;
  return data.data || [];
}

export async function queryMetrics(url: string): Promise<any> {
  const db = process.env.CLICKHOUSE_DB || 'productname';

  const query = `
    SELECT
      count() as total_traces,
      countIf(status_code = 'ERROR') / count() as error_rate,
      sum(accumulated_cost_usd) as total_cost_usd,
      avg(latency_ms) as avg_latency_ms
    FROM agent_spans
    WHERE start_time >= now() - INTERVAL 24 HOUR
    FORMAT JSON
  `;

  const res = await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: query,
  });

  const data = (await res.json()) as any;
  return data.data?.[0] || { total_traces: 0, error_rate: 0, total_cost_usd: 0, avg_latency_ms: 0 };
}
