import { describe, it, expect } from 'vitest';
import { buildServer } from './proxy';

describe('Proxy Server', () => {
  it('should respond to /health with status ok', async () => {
    const server = buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.product).toBe('AeneasSoft');
  });

  it('should accept spans on /ingest', async () => {
    const server = buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/ingest',
      payload: {
        trace_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        span_id: 'a1b2c3d4e5f6a1b2',
        name: 'test.span',
        kind: 'CLIENT',
        start_time_unix_nano: 1700000000000000000,
        end_time_unix_nano: 1700000001000000000,
        status: { code: 'OK' },
        agent_id: 'test-agent',
        agent_name: 'TestAgent',
        agent_role: 'Test',
      },
    });

    expect(response.statusCode).toBe(202);
    const body = JSON.parse(response.body);
    expect(body.accepted).toBe(true);
  });

  it('should reject OpenAI proxy without auth header', async () => {
    const server = buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/openai/v1/chat/completions',
      payload: { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
    });

    expect(response.statusCode).toBe(401);
  });
});
