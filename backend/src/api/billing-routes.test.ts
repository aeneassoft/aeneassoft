// Tests for GET /api/billing, PATCH /api/alerts/:id, DELETE /api/keys/:id
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { registerBillingRoutes } from './billing-routes';
import { registerAlertRoutes } from './alert-routes';
import { registerRoutes } from './routes';
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
  lookupApiKey: vi.fn(),
  queryBillingUsage: vi.fn(),
  getAlertRules: vi.fn(),
  createAlertRule: vi.fn(),
  deleteAlertRule: vi.fn(),
  getAlertHistory: vi.fn(),
  updateAlertIsActive: vi.fn(),
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  countApiKeys: vi.fn(),
  // stubs for routes.ts
  queryTraces: vi.fn(),
  queryTraceSpans: vi.fn(),
  queryMetrics: vi.fn(),
  insertSpan: vi.fn(),
  queryCausalLinks: vi.fn(),
  queryCostDaily: vi.fn(),
  queryCostByAgent: vi.fn(),
  queryCostByModel: vi.fn(),
  assertHexId: vi.fn((id: string) => id),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({})),
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
    expect(body.usage.traces_this_month).toBe(1234);
    expect(body.usage.traces_limit).toBe(100_000);
    expect(body.usage.cost_this_month_usd).toBe(0.42);
    expect(body.current_period_end).toBeNull();
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

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/alerts/550e8400-e29b-41d4-a716-446655440000',
      headers: { authorization: `Bearer ${validToken()}` },
      payload: { is_active: 0 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.is_active).toBe(0);
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
