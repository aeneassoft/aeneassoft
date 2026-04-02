// Tests for GET /api/billing, PATCH /api/alerts/:id, DELETE /api/keys/:id
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { registerBillingRoutes } from './billing-routes';
import { registerAlertRoutes } from './alert-routes';
import { registerRoutes } from './routes';
import { registerStripeRoutes } from './stripe-routes';
import { registerAuthMiddleware } from '../middleware/auth';

const JWT_SECRET = 'test-jwt-secret';
const MOCK_USER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  password_hash: '$2b$10$hash',
  org_id: '660e8400-e29b-41d4-a716-446655440001',
  plan: 'pro',
  stripe_customer_id: 'cus_test',
  stripe_subscription_id: null,
  created_at: '2026-03-28 12:00:00',
};

vi.mock('../db/clickhouse', () => ({
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByStripeCustomerId: vi.fn(),
  findUserByOrgId: vi.fn(),
  updateUser: vi.fn(),
  lookupApiKey: vi.fn(),
  queryBillingUsage: vi.fn(),
  getAlertRules: vi.fn(),
  createAlertRule: vi.fn(),
  deleteAlertRule: vi.fn(),
  getAlertHistory: vi.fn(),
  updateAlertIsActive: vi.fn(),
  getAlertRuleById: vi.fn(),
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  countApiKeys: vi.fn(),
  saveAlertHistory: vi.fn(),
  queryHourlyCBStatus: vi.fn().mockResolvedValue({ hour_cost: 0, error_rate: 0, error_window_calls: 0, calls_per_minute: 0, by_agent: [] }),
  getCBState: vi.fn().mockResolvedValue({ state: 'closed', paused_until: null, budget_override: null, reason: '' }),
  setCBState: vi.fn().mockResolvedValue(undefined),
  // stubs for routes.ts
  queryTraces: vi.fn(),
  queryTraceSpans: vi.fn(),
  queryMetrics: vi.fn(),
  insertSpan: vi.fn(),
  insertSpanBatch: vi.fn(),
  queryCausalLinks: vi.fn(),
  queryCostDaily: vi.fn(),
  queryCostByAgent: vi.fn(),
  queryCostByModel: vi.fn(),
  assertHexId: vi.fn((id: string) => id),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: vi.fn().mockImplementation((body: string) => JSON.parse(body)),
    },
  })),
}));

import * as db from '../db/clickhouse';

function validToken() {
  return jwt.sign(
    { userId: MOCK_USER.id, orgId: MOCK_USER.org_id, email: MOCK_USER.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function buildApp() {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.API_KEY = 'test-api-key'; // disable dev-mode passthrough
  const app = Fastify();
  await registerAuthMiddleware(app);
  await registerBillingRoutes(app);
  await registerAlertRoutes(app);
  await registerRoutes(app);
  await app.ready();
  return app;
}

describe('GET /api/billing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /api/billing — success', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);
    (db.queryBillingUsage as any).mockResolvedValue({ traces_this_month: 1234, cost_this_month_usd: 0.42 });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/billing',
      headers: { authorization: `Bearer ${validToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.plan).toBe('pro');
    expect(body.usage.traces).toBe(1234);
    expect(body.usage.limit).toBe(100_000);
    expect(body.usage.cost_this_month_usd).toBe(0.42);
    expect(body.renewsAt).toBeNull();
    await app.close();
  });

  it('GET /api/billing — no auth (401)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/billing' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('PATCH /api/alerts/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PATCH /api/alerts/:id — toggle off (success)', async () => {
    (db.updateAlertIsActive as any).mockResolvedValue(undefined);
    (db.getAlertRuleById as any).mockResolvedValue(null); // triggers synthetic fallback

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/alerts/550e8400-e29b-41d4-a716-446655440000',
      headers: { authorization: `Bearer ${validToken()}` },
      payload: { enabled: false },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(body.enabled).toBe(false);
    expect(db.updateAlertIsActive).toHaveBeenCalledWith(
      expect.any(String),
      '550e8400-e29b-41d4-a716-446655440000',
      MOCK_USER.org_id,
      0
    );
    await app.close();
  });

  it('PATCH /api/alerts/:id — no auth (401)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/alerts/550e8400-e29b-41d4-a716-446655440000',
      payload: { is_active: 0 },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('DELETE /api/keys/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('DELETE /api/keys/:id — success', async () => {
    (db.countApiKeys as any).mockResolvedValue(2); // 2 keys, can delete one
    (db.deleteApiKey as any).mockResolvedValue(undefined);

    const keyHash = 'a'.repeat(64); // valid 64-char hex
    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/keys/${keyHash}`,
      headers: { authorization: `Bearer ${validToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(db.deleteApiKey).toHaveBeenCalledWith(expect.any(String), keyHash, MOCK_USER.org_id);
    await app.close();
  });

  it('DELETE /api/keys/:id — no auth (401)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/keys/${'a'.repeat(64)}`,
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('POST /stripe/webhook — subscription.deleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  async function buildStripeApp() {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.API_KEY = 'test-api-key';
    const app = Fastify();
    await registerAuthMiddleware(app);
    await registerStripeRoutes(app);
    await app.ready();
    return app;
  }

  it('subscription.deleted → user downgraded to free', async () => {
    (db.findUserByStripeCustomerId as any).mockResolvedValue({ ...MOCK_USER, plan: 'pro' });
    (db.updateUser as any).mockResolvedValue(undefined);

    const event = {
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_test' } },
    };

    const app = await buildStripeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/stripe/webhook',
      headers: { 'stripe-signature': 'test-sig', 'content-type': 'application/json' },
      payload: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(db.findUserByStripeCustomerId).toHaveBeenCalledWith(expect.any(String), 'cus_test');
    expect(db.updateUser).toHaveBeenCalledWith(
      expect.any(String),
      MOCK_USER.email,
      { plan: 'free', stripe_subscription_id: null }
    );
    await app.close();
  });
});

describe('POST /api/ingest — plan limit enforcement', () => {
  beforeEach(() => vi.clearAllMocks());

  const VALID_SPAN = {
    trace_id: 'a'.repeat(32),
    span_id: 'b'.repeat(16),
    name: 'test-span',
    kind: 'INTERNAL',
    start_time_unix_nano: 1000000,
    end_time_unix_nano: 2000000,
    status: { code: 'OK' },
    agent_id: 'agent-1',
    agent_name: 'TestAgent',
    agent_role: 'tester',
  };

  it('free user under limit → 202', async () => {
    (db.findUserByOrgId as any).mockResolvedValue({ ...MOCK_USER, plan: 'free' });
    (db.queryBillingUsage as any).mockResolvedValue({ traces_this_month: 5_000, cost_this_month_usd: 0 });
    (db.insertSpan as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/ingest',
      headers: { authorization: `Bearer ${validToken()}` },
      payload: VALID_SPAN,
    });

    expect(res.statusCode).toBe(202);
    await app.close();
  });

  it('free user at limit → 429', async () => {
    (db.findUserByOrgId as any).mockResolvedValue({ ...MOCK_USER, plan: 'free' });
    (db.queryBillingUsage as any).mockResolvedValue({ traces_this_month: 10_000, cost_this_month_usd: 0 });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/ingest',
      headers: { authorization: `Bearer ${validToken()}` },
      payload: VALID_SPAN,
    });

    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.plan).toBe('free');
    expect(body.limit).toBe(10_000);
    expect(body.upgrade_url).toBe('https://aeneassoft.com/pricing');
    await app.close();
  });

  it('pro user at limit → 429', async () => {
    (db.findUserByOrgId as any).mockResolvedValue({ ...MOCK_USER, plan: 'pro' });
    (db.queryBillingUsage as any).mockResolvedValue({ traces_this_month: 100_000, cost_this_month_usd: 0 });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/ingest',
      headers: { authorization: `Bearer ${validToken()}` },
      payload: VALID_SPAN,
    });

    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.plan).toBe('pro');
    expect(body.limit).toBe(100_000);
    await app.close();
  });

  it('enterprise user → always 202 (no limit)', async () => {
    (db.findUserByOrgId as any).mockResolvedValue({ ...MOCK_USER, plan: 'enterprise' });
    (db.insertSpan as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/ingest',
      headers: { authorization: `Bearer ${validToken()}` },
      payload: VALID_SPAN,
    });

    expect(res.statusCode).toBe(202);
    await app.close();
  });
});

// ── SDK Alert + Circuit Breaker Status ──────────────────────────────────────

describe('POST /api/alerts/sdk-alert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('receives SDK alert and saves to history', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);
    (db.saveAlertHistory as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/alerts/sdk-alert',
      headers: { authorization: `Bearer ${validToken()}` },
      payload: {
        scope: 'agent',
        scope_id: 'ExpensiveBot',
        reason: 'Hourly budget exceeded',
        threshold: 10.0,
        current: 12.50,
        blocked: true,
        timestamp: Date.now() / 1000,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.received).toBe(true);
    expect(db.saveAlertHistory).toHaveBeenCalledOnce();
    await app.close();
  });

  it('rejects alert without reason → 400', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/alerts/sdk-alert',
      headers: { authorization: `Bearer ${validToken()}` },
      payload: { scope: 'global', threshold: 10.0 },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('GET /api/circuit-breaker/status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns live status with budget data', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);
    (db.getAlertRules as any).mockResolvedValue([
      { id: 'r1', trigger_type: 'cost_per_hour', threshold: 10, time_window_minutes: 60, is_active: 1 },
    ]);
    (db.queryHourlyCBStatus as any).mockResolvedValue({
      hour_cost: 3.50, error_rate: 0.05, error_window_calls: 20, calls_per_minute: 5, by_agent: [],
    });
    (db.getAlertHistory as any).mockResolvedValue([]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/circuit-breaker/status',
      headers: { authorization: `Bearer ${validToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('armed');
    expect(body.budget.current_hour_cost).toBe(3.5);
    expect(body.budget.limit).toBe(10);
    expect(body.error_rate.current_rate).toBe(0.05);
    await app.close();
  });

  it('returns disabled when no rules configured', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);
    (db.getAlertRules as any).mockResolvedValue([]);
    (db.queryHourlyCBStatus as any).mockResolvedValue({
      hour_cost: 0, error_rate: 0, error_window_calls: 0, calls_per_minute: 0, by_agent: [],
    });
    (db.getAlertHistory as any).mockResolvedValue([]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/circuit-breaker/status',
      headers: { authorization: `Bearer ${validToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('disabled');
    expect(body.budget.limit).toBeNull();
    await app.close();
  });

  it('returns paused status when CB state is paused', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);
    (db.getAlertRules as any).mockResolvedValue([
      { id: 'r1', trigger_type: 'cost_per_hour', threshold: 10, is_active: 1 },
    ]);
    (db.queryHourlyCBStatus as any).mockResolvedValue({
      hour_cost: 12, error_rate: 0, error_window_calls: 0, calls_per_minute: 0, by_agent: [],
    });
    (db.getAlertHistory as any).mockResolvedValue([]);
    // CB is paused until far in the future
    (db.getCBState as any).mockResolvedValue({
      state: 'paused',
      paused_until: new Date(Date.now() + 60000).toISOString(),
      budget_override: null,
      reason: 'manual',
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/circuit-breaker/status',
      headers: { authorization: `Bearer ${validToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('paused');
    expect(body.paused_until).toBeTruthy();
    await app.close();
  });

  it('reflects budget_override in effective limit', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);
    (db.getAlertRules as any).mockResolvedValue([
      { id: 'r1', trigger_type: 'cost_per_hour', threshold: 10, is_active: 1 },
    ]);
    (db.queryHourlyCBStatus as any).mockResolvedValue({
      hour_cost: 12, error_rate: 0, error_window_calls: 0, calls_per_minute: 0, by_agent: [],
    });
    (db.getAlertHistory as any).mockResolvedValue([]);
    (db.getCBState as any).mockResolvedValue({
      state: 'closed',
      paused_until: null,
      budget_override: 5.0,
      reason: 'budget increased',
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/circuit-breaker/status',
      headers: { authorization: `Bearer ${validToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.budget.limit).toBe(15); // 10 + 5 override
    expect(body.budget_override).toBe(5);
    expect(body.budget.exceeded).toBe(false); // 12 < 15
    await app.close();
  });
});

describe('POST /api/circuit-breaker/pause', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pauses the circuit breaker', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);
    (db.setCBState as any).mockResolvedValue(undefined);
    (db.saveAlertHistory as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/circuit-breaker/pause',
      headers: { authorization: `Bearer ${validToken()}`, 'content-type': 'application/json' },
      payload: { seconds: 120 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('paused');
    expect(body.seconds).toBe(120);
    expect(db.setCBState).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), 'paused',
      expect.any(String), null, expect.any(String), expect.any(String)
    );
    expect(db.saveAlertHistory).toHaveBeenCalled();
    await app.close();
  });

  it('clamps seconds to valid range', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);
    (db.setCBState as any).mockResolvedValue(undefined);
    (db.saveAlertHistory as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/circuit-breaker/pause',
      headers: { authorization: `Bearer ${validToken()}`, 'content-type': 'application/json' },
      payload: { seconds: 5 }, // below min of 10
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.seconds).toBe(10); // clamped to min
    await app.close();
  });
});

describe('POST /api/circuit-breaker/resume', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resumes the circuit breaker', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);
    (db.setCBState as any).mockResolvedValue(undefined);
    (db.saveAlertHistory as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/circuit-breaker/resume',
      headers: { authorization: `Bearer ${validToken()}`, 'content-type': 'application/json' },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('armed');
    expect(db.setCBState).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), 'closed',
      null, null, expect.any(String), expect.any(String)
    );
    await app.close();
  });
});

describe('POST /api/circuit-breaker/override', () => {
  beforeEach(() => vi.clearAllMocks());

  it('increases budget override', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);
    (db.getCBState as any).mockResolvedValue({
      state: 'closed', paused_until: null, budget_override: 3.0, reason: '',
    });
    (db.setCBState as any).mockResolvedValue(undefined);
    (db.saveAlertHistory as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/circuit-breaker/override',
      headers: { authorization: `Bearer ${validToken()}`, 'content-type': 'application/json' },
      payload: { additional_budget: 7.0 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.budget_override).toBe(10); // 3 + 7
    expect(body.added).toBe(7);
    expect(db.setCBState).toHaveBeenCalled();
    expect(db.saveAlertHistory).toHaveBeenCalled();
    await app.close();
  });

  it('starts from 0 if no existing override', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);
    (db.getCBState as any).mockResolvedValue({
      state: 'closed', paused_until: null, budget_override: null, reason: '',
    });
    (db.setCBState as any).mockResolvedValue(undefined);
    (db.saveAlertHistory as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/circuit-breaker/override',
      headers: { authorization: `Bearer ${validToken()}`, 'content-type': 'application/json' },
      payload: { additional_budget: 5.0 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.budget_override).toBe(5); // 0 + 5
    await app.close();
  });
});
