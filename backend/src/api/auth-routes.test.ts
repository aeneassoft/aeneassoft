// Auth routes tests — register, login, password reset, me
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { registerAuthRoutes } from './auth-routes';
import { registerAuthMiddleware } from '../middleware/auth';

const JWT_SECRET = 'test-jwt-secret';
const MOCK_USER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  // bcrypt hash of 'password123' with 10 rounds
  password_hash: '$2b$10$LQv3c1yqBo0.vBnG8pN2xOQHJ3a2I5PF8kJK1Kv6K5hL4m0J4V2W.',
  org_id: '660e8400-e29b-41d4-a716-446655440001',
  plan: 'free',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  created_at: '2026-03-28 12:00:00',
};

// Mock ClickHouse functions
vi.mock('../db/clickhouse', () => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  createUser: vi.fn(),
  createApiKey: vi.fn(),
  updateUser: vi.fn(),
  createPasswordReset: vi.fn(),
  findPasswordReset: vi.fn(),
  markPasswordResetUsed: vi.fn(),
  lookupApiKey: vi.fn(),
}));

// Mock bcrypt to avoid slow hashing in tests
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
    compare: vi.fn(),
  },
}));

import * as db from '../db/clickhouse';
import bcrypt from 'bcrypt';

async function buildApp() {
  process.env.JWT_SECRET = JWT_SECRET;
  delete process.env.API_KEY; // dev mode for simpler testing

  const app = Fastify();
  await registerAuthMiddleware(app);
  await registerAuthRoutes(app);
  await app.ready();
  return app;
}

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── REGISTER ─────────────────────────────────────────────────────────────

  it('POST /auth/register — success', async () => {
    (db.findUserByEmail as any).mockResolvedValue(null);
    (db.createUser as any).mockResolvedValue(undefined);
    (db.createApiKey as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'new@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe('new@example.com');
    expect(body.user.plan).toBe('free');
    expect(body.token).toBeDefined();
    expect(body.api_key).toMatch(/^aw_/);
    expect(res.headers['set-cookie']).toContain('token=');
    await app.close();
  });

  it('POST /auth/register — duplicate email', async () => {
    (db.findUserByEmail as any).mockResolvedValue(MOCK_USER);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('POST /auth/register — invalid email', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'notanemail', password: 'password123' },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /auth/register — short password', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'abc' },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  // ── LOGIN ────────────────────────────────────────────────────────────────

  it('POST /auth/login — success', async () => {
    (db.findUserByEmail as any).mockResolvedValue(MOCK_USER);
    (bcrypt.compare as any).mockResolvedValue(true);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('test@example.com');
    await app.close();
  });

  it('POST /auth/login — wrong password', async () => {
    (db.findUserByEmail as any).mockResolvedValue(MOCK_USER);
    (bcrypt.compare as any).mockResolvedValue(false);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('POST /auth/login — user not found', async () => {
    (db.findUserByEmail as any).mockResolvedValue(null);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'unknown@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  // ── FORGOT PASSWORD ──────────────────────────────────────────────────────

  it('POST /auth/forgot-password — user exists', async () => {
    (db.findUserByEmail as any).mockResolvedValue(MOCK_USER);
    (db.createPasswordReset as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'test@example.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(db.createPasswordReset).toHaveBeenCalled();
    await app.close();
  });

  it('POST /auth/forgot-password — user not found (no enumeration)', async () => {
    (db.findUserByEmail as any).mockResolvedValue(null);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'unknown@example.com' },
    });

    expect(res.statusCode).toBe(200); // Same response to prevent enumeration
    expect(db.createPasswordReset).not.toHaveBeenCalled();
    await app.close();
  });

  // ── RESET PASSWORD ───────────────────────────────────────────────────────

  it('POST /auth/reset-password — valid token', async () => {
    (db.findPasswordReset as any).mockResolvedValue({
      token: 'hashed-token',
      email: 'test@example.com',
      expires_at: '2099-12-31 23:59:59',
    });
    (db.findUserByEmail as any).mockResolvedValue(MOCK_USER);
    (db.updateUser as any).mockResolvedValue(undefined);
    (db.markPasswordResetUsed as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'raw-reset-token', password: 'newpassword123' },
    });

    expect(res.statusCode).toBe(200);
    expect(db.updateUser).toHaveBeenCalled();
    expect(db.markPasswordResetUsed).toHaveBeenCalled();
    await app.close();
  });

  it('POST /auth/reset-password — expired token', async () => {
    (db.findPasswordReset as any).mockResolvedValue(null);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'expired-token', password: 'newpassword123' },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  // ── ME ───────────────────────────────────────────────────────────────────

  it('GET /auth/me — with valid JWT', async () => {
    (db.findUserById as any).mockResolvedValue(MOCK_USER);

    const token = jwt.sign(
      { userId: MOCK_USER.id, orgId: MOCK_USER.org_id, email: MOCK_USER.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe('test@example.com');
    expect(body.user.plan).toBe('free');
    await app.close();
  });

  it('GET /auth/me — without token', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('GET /auth/me — expired JWT', async () => {
    const token = jwt.sign(
      { userId: MOCK_USER.id, orgId: MOCK_USER.org_id, email: MOCK_USER.email },
      JWT_SECRET,
      { expiresIn: '-1s' } // already expired
    );

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
