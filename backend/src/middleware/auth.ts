// [PRODUCTNAME] Auth Middleware — API Key validation
// Reads X-API-Key header, validates against API_KEY env var (single-tenant)
// or ClickHouse api_keys table (multi-tenant). Protects all /api/* routes.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash, timingSafeEqual } from 'crypto';
import { lookupApiKey } from '../db/clickhouse';

const API_KEY_HEADER = 'x-api-key';
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

function sha256buf(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

interface AuthResult {
  authorized: boolean;
  org_id?: string;
}

async function resolveAuth(request: FastifyRequest): Promise<AuthResult> {
  const configuredKey = process.env.API_KEY;
  const providedKey = request.headers[API_KEY_HEADER] as string | undefined;

  // Dev mode: if no API_KEY configured, allow all requests
  if (!configuredKey && !providedKey) return { authorized: true, org_id: 'default' };

  if (!providedKey) return { authorized: false };

  // 1. Check against single-tenant API_KEY env var (backwards compatible)
  if (configuredKey) {
    const match = timingSafeEqual(sha256buf(providedKey), sha256buf(configuredKey));
    if (match) return { authorized: true, org_id: 'default' };
  }

  // 2. Check against multi-tenant api_keys table in ClickHouse
  try {
    const result = await lookupApiKey(CLICKHOUSE_URL, providedKey);
    if (result) return { authorized: true, org_id: result.org_id };
  } catch {
    // ClickHouse unavailable — fall through
  }

  // 3. Dev mode: if no single-tenant key configured, accept any key
  if (!configuredKey) return { authorized: true, org_id: 'default' };

  return { authorized: false };
}

// Attach org_id to request for downstream route handlers
declare module 'fastify' {
  interface FastifyRequest {
    orgId?: string;
  }
}

export async function registerAuthMiddleware(fastify: FastifyInstance): Promise<void> {
  // Decorate request with orgId
  fastify.decorateRequest('orgId', '');

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Exempt non-api routes and health
    if (!request.url.startsWith('/api/')) return;

    const auth = await resolveAuth(request);
    if (!auth.authorized) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid API key. Provide X-API-Key header.',
      });
    }

    request.orgId = auth.org_id || 'default';
  });
}
