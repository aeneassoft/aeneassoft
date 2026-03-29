// [PRODUCTNAME] Auth Middleware — Dual authentication: JWT + API Key
// JWT: for browser/dashboard sessions (Authorization: Bearer <token> or cookie)
// API Key: for SDK/programmatic access (X-API-Key header)
// Both set request.orgId. JWT also sets request.userId.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { lookupApiKey } from '../db/clickhouse';

const API_KEY_HEADER = 'x-api-key';
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';
function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'dev-secret-change-in-production';
}

function sha256buf(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

// ── JWT Resolution ───────────────────────────────────────────────────────────

interface JwtPayload {
  userId: string;
  orgId: string;
  email: string;
}

interface AuthResult {
  authorized: boolean;
  userId?: string;
  orgId?: string;
}

function resolveJwt(request: FastifyRequest): AuthResult {
  // Check Authorization: Bearer <token> header
  let token: string | undefined;
  const authHeader = request.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // Fallback: check cookie
  if (!token) {
    const cookie = request.headers['cookie'];
    if (cookie) {
      const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
      if (match) token = match[1];
    }
  }

  if (!token) return { authorized: false };

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    if (payload.userId && payload.orgId) {
      return { authorized: true, userId: payload.userId, orgId: payload.orgId };
    }
    return { authorized: false };
  } catch {
    return { authorized: false };
  }
}

// ── API Key Resolution ───────────────────────────────────────────────────────

async function resolveApiKey(request: FastifyRequest): Promise<AuthResult> {
  const configuredKey = process.env.API_KEY;
  const providedKey = request.headers[API_KEY_HEADER] as string | undefined;

  // Dev mode: if no API_KEY configured and no key provided, allow all
  if (!configuredKey && !providedKey) return { authorized: true, orgId: 'default' };

  if (!providedKey) return { authorized: false };

  // 1. Single-tenant API_KEY env var (backwards compatible)
  if (configuredKey) {
    const match = timingSafeEqual(sha256buf(providedKey), sha256buf(configuredKey));
    if (match) return { authorized: true, orgId: 'default' };
  }

  // 2. Multi-tenant api_keys table in ClickHouse
  try {
    const result = await lookupApiKey(CLICKHOUSE_URL, providedKey);
    if (result) return { authorized: true, orgId: result.org_id };
  } catch {
    // ClickHouse unavailable — fall through
  }

  // 3. Dev mode fallback
  if (!configuredKey) return { authorized: true, orgId: 'default' };

  return { authorized: false };
}

// ── Fastify Request Extension ────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    orgId?: string;
    userId?: string;
  }
}

// ── Middleware Registration ───────────────────────────────────────────────────

// Paths that never require auth
const PUBLIC_PATHS = [
  '/health',
  '/auth/register',
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/logout',
  '/stripe/webhook',
  '/api/contact',
];

export async function registerAuthMiddleware(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('orgId', '');
  fastify.decorateRequest('userId', '');

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Exempt non-API, non-auth routes
    const path = request.url.split('?')[0];
    if (!path.startsWith('/api/') && !path.startsWith('/auth/') && !path.startsWith('/stripe/')) return;

    // Exempt public paths
    if (PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'))) return;

    // 1. Try JWT first (browser sessions)
    const jwtResult = resolveJwt(request);
    if (jwtResult.authorized) {
      request.userId = jwtResult.userId;
      request.orgId = jwtResult.orgId;
      return;
    }

    // 2. Fallback to API key (SDK/programmatic)
    const apiKeyResult = await resolveApiKey(request);
    if (apiKeyResult.authorized) {
      request.orgId = apiKeyResult.orgId;
      return;
    }

    // 3. Reject
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Provide a valid JWT token (Authorization: Bearer <token>) or API key (X-API-Key header).',
    });
  });
}
