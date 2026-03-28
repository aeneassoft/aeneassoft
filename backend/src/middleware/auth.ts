// [PRODUCTNAME] Auth Middleware — API Key validation
// Reads X-[PRODUCTNAME]-API-Key header, compares SHA-256 hash against API_KEY env var.
// Protects all /api/* routes; /health is exempt.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';

const API_KEY_HEADER = 'x-[productname]-api-key';

/**
 * Returns the SHA-256 hex digest of a string.
 */
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Validates the incoming API key against the configured secret.
 * Returns true if auth passes, false otherwise.
 */
function isAuthorized(request: FastifyRequest): boolean {
  const configuredKey = process.env.API_KEY;

  // If API_KEY is not set, auth is disabled (dev mode only)
  if (!configuredKey) return true;

  const providedKey = request.headers[API_KEY_HEADER] as string | undefined;
  if (!providedKey) return false;

  // Constant-time comparison via SHA-256 to prevent timing attacks
  return sha256(providedKey) === sha256(configuredKey);
}

/**
 * Registers an onRequest hook that protects all /api/* routes.
 * /health is explicitly exempt.
 */
export async function registerAuthMiddleware(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Exempt health check and non-api routes
    if (!request.url.startsWith('/api/')) return;

    if (!isAuthorized(request)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid API key. Provide X-[PRODUCTNAME]-API-Key header.',
      });
    }
  });
}
