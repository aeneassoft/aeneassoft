// Auth middleware tests — valid key → 200, missing key → 401
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { registerAuthMiddleware } from './auth';

const TEST_API_KEY = 'test-secret-key-12345';

async function buildApp(apiKey?: string) {
  if (apiKey) {
    process.env.API_KEY = apiKey;
  } else {
    delete process.env.API_KEY;
  }

  const app = Fastify();
  await registerAuthMiddleware(app);

  app.get('/api/test', async (request) => ({ ok: true, orgId: request.orgId }));
  app.get('/health', async () => ({ status: 'ok' }));

  await app.ready();
  return app;
}

describe('Auth Middleware', () => {
  it('returns 200 for /health without API key', async () => {
    const app = await buildApp(TEST_API_KEY);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('returns 401 for /api/* when API_KEY is set and header is missing', async () => {
    const app = await buildApp(TEST_API_KEY);
    const res = await app.inject({ method: 'GET', url: '/api/test' });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Unauthorized');
    await app.close();
  });

  it('returns 200 for /api/* when correct API key is provided', async () => {
    const app = await buildApp(TEST_API_KEY);
    const res = await app.inject({
      method: 'GET',
      url: '/api/test',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.orgId).toBe('default');
    await app.close();
  });

  it('returns 401 for /api/* when wrong API key is provided', async () => {
    const app = await buildApp(TEST_API_KEY);
    const res = await app.inject({
      method: 'GET',
      url: '/api/test',
      headers: { 'x-api-key': 'wrong-key' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('allows all /api/* requests when API_KEY env var is not set (dev mode)', async () => {
    const app = await buildApp(undefined);
    const res = await app.inject({ method: 'GET', url: '/api/test' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
