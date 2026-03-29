// [PRODUCTNAME] ClickHouse Schema for ATP Spans
// TTL based on DATA_RETENTION_DAYS (default: 30)

const retentionDays = process.env.DATA_RETENTION_DAYS || '30';

export const CREATE_SPANS_TABLE = `
CREATE TABLE IF NOT EXISTS agent_spans (
  trace_id       FixedString(32),
  span_id        FixedString(16),
  parent_span_id Nullable(FixedString(16)),
  org_id         String DEFAULT '',
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
ORDER BY (org_id, trace_id, start_time, span_id)
TTL toDateTime(start_time) + INTERVAL ${retentionDays} DAY
SETTINGS index_granularity = 8192;
`;

export const CREATE_CAUSAL_LINKS_TABLE = `
CREATE TABLE IF NOT EXISTS agent_causal_links (
  trace_id    FixedString(32),
  source_span FixedString(16),
  target_span FixedString(16),
  link_type   LowCardinality(String),
  org_id      String DEFAULT '',
  created_at  DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (org_id, trace_id, source_span, target_span)
TTL created_at + INTERVAL ${retentionDays} DAY;
`;

export const CREATE_API_KEYS_TABLE = `
CREATE TABLE IF NOT EXISTS api_keys (
  key_hash    FixedString(64),
  org_id      String,
  label       String DEFAULT '',
  scopes      Array(String) DEFAULT ['read', 'write'],
  created_at  DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree()
ORDER BY (key_hash);
`;

export const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id             String,
  email          String,
  password_hash  String,
  org_id         String,
  plan           LowCardinality(String) DEFAULT 'free',
  stripe_customer_id    Nullable(String),
  stripe_subscription_id Nullable(String),
  created_at     DateTime DEFAULT now(),
  updated_at     DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (email);
`;

export const CREATE_PASSWORD_RESETS_TABLE = `
CREATE TABLE IF NOT EXISTS password_resets (
  token       String,
  email       String,
  expires_at  DateTime,
  used        UInt8 DEFAULT 0,
  created_at  DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (token)
TTL expires_at + INTERVAL 1 DAY;
`;

export const CREATE_ALERT_RULES_TABLE = `
CREATE TABLE IF NOT EXISTS alert_rules (
  id             String,
  org_id         String,
  name           String,
  trigger_type   LowCardinality(String),
  threshold      Float64,
  time_window_minutes UInt32 DEFAULT 60,
  action_type    LowCardinality(String),
  action_target  String,
  is_active      UInt8 DEFAULT 1,
  created_at     DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree()
ORDER BY (org_id, id);
`;

export const CREATE_ALERT_HISTORY_TABLE = `
CREATE TABLE IF NOT EXISTS alert_history (
  id             String,
  rule_id        String,
  org_id         String,
  triggered_at   DateTime DEFAULT now(),
  value          Float64,
  message        String
) ENGINE = MergeTree()
ORDER BY (org_id, triggered_at)
TTL triggered_at + INTERVAL 30 DAY;
`;

export const CREATE_DAILY_COST_TABLE = `
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_cost_mv
ENGINE = SummingMergeTree()
ORDER BY (org_id, day, agent_id, model_name)
AS SELECT
  org_id,
  toDate(start_time) AS day,
  agent_id,
  model_name,
  count() AS call_count,
  sum(prompt_tokens) AS total_prompt_tokens,
  sum(completion_tokens) AS total_completion_tokens,
  sum(accumulated_cost_usd) AS total_cost_usd
FROM agent_spans
GROUP BY org_id, day, agent_id, model_name;
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

  await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: CREATE_API_KEYS_TABLE,
  });

  await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: CREATE_USERS_TABLE,
  });

  await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: CREATE_ALERT_RULES_TABLE,
  });

  await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: CREATE_ALERT_HISTORY_TABLE,
  });

  await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: CREATE_PASSWORD_RESETS_TABLE,
  });

  await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: CREATE_DAILY_COST_TABLE,
  });

  // Non-breaking column additions (IF NOT EXISTS)
  await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: `ALTER TABLE users ADD COLUMN IF NOT EXISTS name Nullable(String)`,
  });
  await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: `ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS rule_name Nullable(String)`,
  });

  console.log(`[PRODUCTNAME] ClickHouse tables initialized (TTL: ${retentionDays} days)`);
}

// Single span insert — used by /api/ingest direct path
export async function insertSpan(url: string, span: any): Promise<void> {
  return insertSpanBatch(url, [span]);
}

// Serialize one span to a row object
function spanToRow(span: any, zdr: boolean, orgId: string = ''): Record<string, any> {
  return {
    trace_id: span.trace_id,
    span_id: span.span_id,
    parent_span_id: span.parent_span_id || null,
    org_id: orgId,
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
export async function insertSpanBatch(url: string, spans: any[], orgId: string = ''): Promise<void> {
  if (spans.length === 0) return;
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const zdr = process.env.ZERO_DATA_RETENTION === 'true';

  const rows = spans.map((s) => spanToRow(s, zdr, orgId));
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

export interface TraceQueryParams {
  limit?: number;
  offset?: number;
  status?: string;
  agent_id?: string;
  model?: string;
  from?: string;
  to?: string;
}

// Strict allowlists for filter values — prevents SQL injection
const VALID_STATUS = /^(OK|ERROR|UNSET)$/;
const VALID_IDENTIFIER = /^[a-zA-Z0-9._\-]{1,128}$/;
const VALID_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/;

function sanitizeFilter(value: string, pattern: RegExp): string | null {
  return pattern.test(value) ? value : null;
}

export async function queryTraces(url: string, limit = 20, params: TraceQueryParams = {}): Promise<{ traces: any[]; total: number }> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const conditions = ['parent_span_id IS NULL'];
  if (params.status) {
    const safe = sanitizeFilter(params.status, VALID_STATUS);
    if (safe) conditions.push(`status_code = '${safe}'`);
  }
  if (params.agent_id) {
    const safe = sanitizeFilter(params.agent_id, VALID_IDENTIFIER);
    if (safe) conditions.push(`agent_id = '${safe}'`);
  }
  if (params.model) {
    const safe = sanitizeFilter(params.model, VALID_IDENTIFIER);
    if (safe) conditions.push(`model_name = '${safe}'`);
  }
  if (params.from) {
    const safe = sanitizeFilter(params.from, VALID_DATE);
    if (safe) conditions.push(`start_time >= '${safe}'`);
  }
  if (params.to) {
    const safe = sanitizeFilter(params.to, VALID_DATE);
    if (safe) conditions.push(`start_time <= '${safe}'`);
  }
  const effectiveLimit = Math.min(Math.max(params.limit || limit, 1), 500);
  const effectiveOffset = Math.max(params.offset || 0, 0);
  const query = `
    SELECT *
    FROM agent_spans
    WHERE ${conditions.join(' AND ')}
    ORDER BY start_time DESC
    LIMIT ${effectiveLimit}
    OFFSET ${effectiveOffset}
    FORMAT JSON
  `;

  const res = await fetch(`${url}/?database=${db}`, {
    method: 'POST',
    body: query,
  });

  const data = (await res.json()) as any;
  const traces = data.data || [];

  // Count total matching traces (for pagination)
  const where = conditions.join(' AND ');
  const countQuery = `SELECT count() as total FROM agent_spans WHERE ${where} FORMAT JSON`;

  // Batch span counts per trace_id (single query, no N+1)
  const traceIds = traces.map((t: any) => t.trace_id).filter(Boolean);
  const spanCountQuery = traceIds.length > 0
    ? `SELECT trace_id, count() as span_count FROM agent_spans WHERE trace_id IN (${traceIds.map((id: string) => `'${id}'`).join(',')}) GROUP BY trace_id FORMAT JSON`
    : null;

  // Fire both queries in parallel
  const [countRes, spanCountRes] = await Promise.all([
    fetch(`${url}/?database=${db}`, { method: 'POST', body: countQuery }),
    spanCountQuery ? fetch(`${url}/?database=${db}`, { method: 'POST', body: spanCountQuery }) : Promise.resolve(null),
  ]);

  const countData = (await countRes.json()) as any;
  const total = Number(countData.data?.[0]?.total) || traces.length;

  // Attach span_count to each trace
  if (spanCountRes) {
    const spanData = (await spanCountRes.json()) as any;
    const countMap = new Map<string, number>();
    for (const row of (spanData.data || [])) {
      countMap.set(row.trace_id, Number(row.span_count) || 0);
    }
    for (const trace of traces) {
      trace.span_count = countMap.get(trace.trace_id) || 1;
    }
  }

  return { traces, total };
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

  const [mainRes, monthRes] = await Promise.all([
    fetch(`${url}/?database=${db}`, {
      method: 'POST',
      body: `
        SELECT
          count() as total_traces,
          countIf(status_code = 'ERROR') / greatest(count(), 1) as error_rate,
          sum(accumulated_cost_usd) as total_cost_usd,
          avg(latency_ms) as avg_latency_ms,
          sum(prompt_tokens + completion_tokens) as total_tokens
        FROM agent_spans
        WHERE start_time >= now() - INTERVAL 24 HOUR
        FORMAT JSON
      `,
    }),
    fetch(`${url}/?database=${db}`, {
      method: 'POST',
      body: `SELECT countDistinct(trace_id) as traces_this_month FROM agent_spans WHERE toYYYYMM(start_time) = toYYYYMM(now()) FORMAT JSON`,
    }),
  ]);

  const mainData = (await mainRes.json()) as any;
  const monthData = (await monthRes.json()) as any;
  const m = mainData.data?.[0] || {};
  return {
    ...m,
    traces_this_month: Number(monthData.data?.[0]?.traces_this_month) || 0,
  };
}

// ── API Key Management ───────────────────────────────────────────────────────

import { createHash } from 'crypto';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function createApiKey(url: string, rawKey: string, orgId: string, label: string = ''): Promise<void> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const keyHash = hashKey(rawKey);
  const safeLabel = label.replace(/'/g, "\\'");
  const query = `INSERT INTO api_keys (key_hash, org_id, label) VALUES ('${keyHash}', '${orgId}', '${safeLabel}')`;
  await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
}

export async function lookupApiKey(url: string, rawKey: string): Promise<{ org_id: string; scopes: string[] } | null> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const keyHash = hashKey(rawKey);
  const query = `SELECT org_id, scopes FROM api_keys WHERE key_hash = '${keyHash}' LIMIT 1 FORMAT JSON`;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  const row = data.data?.[0];
  if (!row) return null;
  return { org_id: row.org_id, scopes: row.scopes };
}

export async function listApiKeys(url: string, orgId: string): Promise<any[]> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const safeOrg = sanitizeFilter(orgId, VALID_IDENTIFIER) || 'default';
  const query = `SELECT key_hash, label, scopes, created_at FROM api_keys WHERE org_id = '${safeOrg}' FORMAT JSON`;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data || [];
}

// ── Cost Rollup Queries ──────────────────────────────────────────────────────

export async function queryCostDaily(url: string, from?: string, to?: string): Promise<any[]> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const conditions: string[] = [];
  if (from) { const safe = sanitizeFilter(from, VALID_DATE); if (safe) conditions.push(`day >= '${safe}'`); }
  if (to) { const safe = sanitizeFilter(to, VALID_DATE); if (safe) conditions.push(`day <= '${safe}'`); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT
      day,
      sum(call_count) AS calls,
      sum(total_prompt_tokens) AS prompt_tokens,
      sum(total_completion_tokens) AS completion_tokens,
      sum(total_cost_usd) AS cost_usd
    FROM daily_cost_mv
    ${where}
    GROUP BY day
    ORDER BY day ASC
    FORMAT JSON
  `;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data || [];
}

export async function queryCostByAgent(url: string, from?: string, to?: string): Promise<any[]> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const conditions: string[] = [];
  if (from) { const safe = sanitizeFilter(from, VALID_DATE); if (safe) conditions.push(`day >= '${safe}'`); }
  if (to) { const safe = sanitizeFilter(to, VALID_DATE); if (safe) conditions.push(`day <= '${safe}'`); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT
      agent_id,
      sum(call_count) AS calls,
      sum(total_prompt_tokens) AS prompt_tokens,
      sum(total_completion_tokens) AS completion_tokens,
      sum(total_cost_usd) AS cost_usd
    FROM daily_cost_mv
    ${where}
    GROUP BY agent_id
    ORDER BY cost_usd DESC
    FORMAT JSON
  `;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data || [];
}

export async function queryCostByModel(url: string, from?: string, to?: string): Promise<any[]> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const conditions: string[] = [];
  if (from) { const safe = sanitizeFilter(from, VALID_DATE); if (safe) conditions.push(`day >= '${safe}'`); }
  if (to) { const safe = sanitizeFilter(to, VALID_DATE); if (safe) conditions.push(`day <= '${safe}'`); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT
      model_name,
      sum(call_count) AS calls,
      sum(total_prompt_tokens) AS prompt_tokens,
      sum(total_completion_tokens) AS completion_tokens,
      sum(total_cost_usd) AS cost_usd
    FROM daily_cost_mv
    ${where}
    GROUP BY model_name
    ORDER BY cost_usd DESC
    FORMAT JSON
  `;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data || [];
}

// ── User Management ──────────────────────────────────────────────────────────

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_UUID = /^[0-9a-f-]{36}$/;

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  org_id: string;
  plan: string;
  name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

export async function createUser(
  url: string, id: string, email: string, passwordHash: string, orgId: string, name?: string
): Promise<void> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const safeEmail = email.replace(/'/g, "\\'");
  const safeHash = passwordHash.replace(/'/g, "\\'");
  const safeName = name ? `'${name.replace(/'/g, "\\'")}'` : 'NULL';
  const query = `INSERT INTO users (id, email, password_hash, org_id, name) VALUES ('${id}', '${safeEmail}', '${safeHash}', '${orgId}', ${safeName})`;
  await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
}

export async function findUserByEmail(url: string, email: string): Promise<UserRow | null> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  if (!VALID_EMAIL.test(email)) return null;
  const safeEmail = email.replace(/'/g, "\\'");
  const query = `SELECT * FROM users FINAL WHERE email = '${safeEmail}' LIMIT 1 FORMAT JSON`;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data?.[0] || null;
}

export async function findUserById(url: string, id: string): Promise<UserRow | null> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  if (!VALID_UUID.test(id)) return null;
  const query = `SELECT * FROM users FINAL WHERE id = '${id}' LIMIT 1 FORMAT JSON`;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data?.[0] || null;
}

const VALID_STRIPE_CUSTOMER = /^cus_[a-zA-Z0-9]{1,50}$/;

export async function findUserByStripeCustomerId(url: string, customerId: string): Promise<UserRow | null> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  if (!VALID_STRIPE_CUSTOMER.test(customerId)) return null;
  const safeId = customerId.replace(/'/g, "\\'");
  const query = `SELECT * FROM users FINAL WHERE stripe_customer_id = '${safeId}' LIMIT 1 FORMAT JSON`;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data?.[0] || null;
}

export async function updateUser(
  url: string, email: string, fields: Partial<Pick<UserRow, 'password_hash' | 'plan' | 'stripe_customer_id' | 'stripe_subscription_id'>>
): Promise<void> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const current = await findUserByEmail(url, email);
  if (!current) return;
  const updated = { ...current, ...fields };
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const safeEmail = updated.email.replace(/'/g, "\\'");
  const safeHash = updated.password_hash.replace(/'/g, "\\'");
  const safePlan = updated.plan.replace(/'/g, "\\'");
  const query = `INSERT INTO users (id, email, password_hash, org_id, plan, stripe_customer_id, stripe_subscription_id, updated_at) VALUES ('${updated.id}', '${safeEmail}', '${safeHash}', '${updated.org_id}', '${safePlan}', ${updated.stripe_customer_id ? `'${updated.stripe_customer_id}'` : 'NULL'}, ${updated.stripe_subscription_id ? `'${updated.stripe_subscription_id}'` : 'NULL'}, '${ts}')`;
  await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
}

// ── Password Resets ──────────────────────────────────────────────────────────

export async function createPasswordReset(url: string, tokenHash: string, email: string, expiresAt: string): Promise<void> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const safeEmail = email.replace(/'/g, "\\'");
  const query = `INSERT INTO password_resets (token, email, expires_at) VALUES ('${tokenHash}', '${safeEmail}', '${expiresAt}')`;
  await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
}

export async function findPasswordReset(url: string, tokenHash: string): Promise<{ token: string; email: string; expires_at: string } | null> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const query = `SELECT * FROM password_resets FINAL WHERE token = '${tokenHash}' AND used = 0 AND expires_at > now() LIMIT 1 FORMAT JSON`;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data?.[0] || null;
}

export async function markPasswordResetUsed(url: string, tokenHash: string): Promise<void> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const current = await findPasswordReset(url, tokenHash);
  if (!current) return;
  const query = `INSERT INTO password_resets (token, email, expires_at, used) VALUES ('${tokenHash}', '${current.email}', '${current.expires_at}', 1)`;
  await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
}

// ── Alert Management ─────────────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  org_id: string;
  name: string;
  trigger_type: string;
  threshold: number;
  time_window_minutes: number;
  action_type: string;
  action_target: string;
  is_active: number;
  created_at: string;
}

export async function getAlertRules(url: string, orgId?: string): Promise<AlertRule[]> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const where = orgId ? `WHERE org_id = '${sanitizeFilter(orgId, VALID_IDENTIFIER) || 'default'}'` : '';
  const query = `SELECT * FROM alert_rules FINAL ${where} ORDER BY created_at DESC FORMAT JSON`;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data || [];
}

export async function getActiveAlertRules(url: string): Promise<AlertRule[]> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const query = `SELECT * FROM alert_rules FINAL WHERE is_active = 1 FORMAT JSON`;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data || [];
}

export async function createAlertRule(url: string, rule: Omit<AlertRule, 'created_at'>): Promise<void> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const query = `INSERT INTO alert_rules (id, org_id, name, trigger_type, threshold, time_window_minutes, action_type, action_target, is_active) VALUES ('${rule.id}', '${rule.org_id}', '${rule.name.replace(/'/g, "\\'")}', '${rule.trigger_type}', ${rule.threshold}, ${rule.time_window_minutes}, '${rule.action_type}', '${rule.action_target.replace(/'/g, "\\'")}', ${rule.is_active})`;
  await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
}

export async function deleteAlertRule(url: string, ruleId: string, orgId: string): Promise<void> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const query = `ALTER TABLE alert_rules DELETE WHERE id = '${ruleId}' AND org_id = '${orgId}'`;
  await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
}

export async function saveAlertHistory(url: string, entry: { id: string; rule_id: string; rule_name?: string; org_id: string; value: number; message: string }): Promise<void> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const safeRuleName = entry.rule_name ? `'${entry.rule_name.replace(/'/g, "\\'")}'` : 'NULL';
  const query = `INSERT INTO alert_history (id, rule_id, rule_name, org_id, value, message) VALUES ('${entry.id}', '${entry.rule_id}', ${safeRuleName}, '${entry.org_id}', ${entry.value}, '${entry.message.replace(/'/g, "\\'")}')`;
  await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
}

export async function getAlertHistory(url: string, orgId: string, limit = 50): Promise<any[]> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const safeOrg = sanitizeFilter(orgId, VALID_IDENTIFIER) || 'default';
  const query = `SELECT * FROM alert_history WHERE org_id = '${safeOrg}' ORDER BY triggered_at DESC LIMIT ${Math.min(limit, 200)} FORMAT JSON`;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data || [];
}

export async function getAlertRuleById(url: string, id: string, orgId: string): Promise<AlertRule | null> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const safeOrg = sanitizeFilter(orgId, VALID_IDENTIFIER) || 'default';
  const query = `SELECT * FROM alert_rules FINAL WHERE id = '${id}' AND org_id = '${safeOrg}' LIMIT 1 FORMAT JSON`;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return data.data?.[0] || null;
}

export async function updateAlertIsActive(url: string, id: string, orgId: string, isActive: 0 | 1): Promise<void> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const query = `ALTER TABLE alert_rules UPDATE is_active = ${isActive} WHERE id = '${id}' AND org_id = '${orgId}'`;
  await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
}

export async function queryBillingUsage(url: string, orgId: string): Promise<{ traces_this_month: number; cost_this_month_usd: number }> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const safeOrg = sanitizeFilter(orgId, VALID_IDENTIFIER) || 'default';

  const [tracesRes, costRes] = await Promise.all([
    fetch(`${url}/?database=${db}`, {
      method: 'POST',
      body: `SELECT count() as total FROM agent_spans WHERE org_id = '${safeOrg}' AND toYYYYMM(start_time) = toYYYYMM(now()) FORMAT JSON`,
    }),
    fetch(`${url}/?database=${db}`, {
      method: 'POST',
      body: `SELECT sum(total_cost_usd) as cost FROM daily_cost_mv WHERE org_id = '${safeOrg}' AND toYYYYMM(day) = toYYYYMM(now()) FORMAT JSON`,
    }),
  ]);

  const tracesData = (await tracesRes.json()) as any;
  const costData = (await costRes.json()) as any;

  return {
    traces_this_month: Number(tracesData.data?.[0]?.total) || 0,
    cost_this_month_usd: Number(costData.data?.[0]?.cost) || 0,
  };
}

export async function deleteApiKey(url: string, keyHash: string, orgId: string): Promise<void> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const query = `ALTER TABLE api_keys DELETE WHERE key_hash = '${keyHash}' AND org_id = '${orgId}'`;
  await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
}

export async function countApiKeys(url: string, orgId: string): Promise<number> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const safeOrg = sanitizeFilter(orgId, VALID_IDENTIFIER) || 'default';
  const query = `SELECT count() as total FROM api_keys WHERE org_id = '${safeOrg}' FORMAT JSON`;
  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return Number(data.data?.[0]?.total) || 0;
}

export async function checkAlertCondition(url: string, rule: AlertRule): Promise<number> {
  const db = process.env.CLICKHOUSE_DB || 'productname';
  const orgFilter = rule.org_id ? `AND org_id = '${rule.org_id}'` : '';
  const timeFilter = `AND start_time >= now() - INTERVAL ${rule.time_window_minutes} MINUTE`;

  let query: string;
  switch (rule.trigger_type) {
    case 'cost_per_hour':
      query = `SELECT sum(accumulated_cost_usd) as val FROM agent_spans WHERE 1=1 ${orgFilter} ${timeFilter} FORMAT JSON`;
      break;
    case 'error_rate':
      query = `SELECT countIf(status_code = 'ERROR') * 100.0 / count() as val FROM agent_spans WHERE 1=1 ${orgFilter} ${timeFilter} FORMAT JSON`;
      break;
    case 'cost_per_agent':
      query = `SELECT max(agent_cost) as val FROM (SELECT agent_id, sum(accumulated_cost_usd) as agent_cost FROM agent_spans WHERE 1=1 ${orgFilter} ${timeFilter} GROUP BY agent_id) FORMAT JSON`;
      break;
    default:
      return 0;
  }

  const res = await fetch(`${url}/?database=${db}`, { method: 'POST', body: query });
  const data = (await res.json()) as any;
  return Number(data.data?.[0]?.val) || 0;
}
