// [PRODUCTNAME] Auth Middleware — API Key validation
// Reads X-[PRODUCTNAME]-API-Key header, compares SHA-256 hash against API_KEY env var.
// Protects all /api/* routes; /health is exempt.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash, timingSafeEqual } from 'crypto';

const API_KEY_HEADER = 'x-[productname]-api-key';

/**
 * Returns the SHA-256 digest of a string as a Buffer.
 */
function sha256buf(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * Validates the incoming API key against the configured secret.
 * Uses timingSafeEqual to prevent timing attacks.
 * Returns true if auth passes, false otherwise.
 */
function isAuthorized(request: FastifyRequest): boolean {
  const configuredKey = process.env.API_KEY;

  // If API_KEY is not set, auth is disabled (dev mode only)
  if (!configuredKey) return true;

  const providedKey = request.headers[API_KEY_HEADER] as string | undefined;
  if (!providedKey) return false;

  // timingSafeEqual requires same-length buffers — comparing hashes guarantees that
  return timingSafeEqual(sha256buf(providedKey), sha256buf(configuredKey));
}

/**
 * Registers an onRequest hook that protects all /api/* routes.
 * /health is explicitly exempt.
 */
export async function registerAuthMiddleware(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Exempt health check, non-api routes, and public demo routes
    if (!request.url.startsWith('/api/')) return;
    if (request.url.startsWith('/api/demo')) return;

    if (!isAuthorized(request)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid API key. Provide X-[PRODUCTNAME]-API-Key header.',
      });
    }
  });
}
