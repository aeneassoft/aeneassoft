// [PRODUCTNAME] API Proxy
// Routes are auto-registered from providers.ts — add new AI providers there.
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import { sendSpanToKafka } from './kafka-producer';
import { ATPSpanSchema } from '@productname/atp-schema';
import { PROVIDERS } from './providers';

const ZERO_DATA_RETENTION = process.env.ZERO_DATA_RETENTION === 'true';

export function buildServer() {
  const fastify = Fastify({ logger: true, bodyLimit: 524_288 });

  // Rate limit: 200 req/min per IP (proxy handles upstream API calls)
  fastify.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded — max 200 requests/minute per IP',
    }),
  });

  // ── Health check ──────────────────────────────────────────────────────────
  fastify.get('/health', async () => ({
    status: 'ok',
    product: '[PRODUCTNAME]',
    zdr: ZERO_DATA_RETENTION,
    providers: PROVIDERS.map((p) => p.name),
  }));

  // ── Direct ATP span ingest (for SDKs) ─────────────────────────────────────
  fastify.post('/ingest', async (request, reply) => {
    const parsed = ATPSpanSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid ATP span',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    setImmediate(() => sendSpanToKafka(parsed.data));
    return reply.status(202).send({ accepted: true });
  });

  // ── Auto-register one wildcard route per provider ─────────────────────────
  for (const provider of PROVIDERS) {
    fastify.all(`${provider.routePrefix}/*`, async (request, reply) => {
      const startTime = Date.now();

      // Forward path: strip the provider prefix, keep the rest
      const subPath = (request.params as any)['*'];
      const upstreamUrl = `${provider.upstreamBase()}/${subPath}`;

      // Build headers to forward
      const forwardHeaders = provider.forwardHeaders(request.headers as Record<string, any>);

      try {
        const response = await fetch(upstreamUrl, {
          method: request.method,
          headers: forwardHeaders,
          ...(request.method !== 'GET' && { body: JSON.stringify(request.body) }),
        });

        const data = (await response.json()) as any;
        const latencyMs = Date.now() - startTime;

        // Emit span asynchronously — never blocks the response
        setImmediate(async () => {
          try {
            const meta = provider.extractMeta(
              request.body,
              data,
              latencyMs,
              ZERO_DATA_RETENTION
            );

            const span = {
              trace_id: uuidv4().replace(/-/g, ''),
              span_id: uuidv4().replace(/-/g, '').substring(0, 16),
              kind: 'CLIENT' as const,
              start_time_unix_nano: startTime * 1_000_000,
              end_time_unix_nano: (startTime + latencyMs) * 1_000_000,
              status: { code: (response.ok ? 'OK' : 'ERROR') as 'OK' | 'ERROR' },
              agent_id: `proxy-${provider.name}`,
              agent_name: '[PRODUCTNAME] Proxy',
              agent_role: 'Interceptor',
              cost_attribution: {
                task_id: (request.headers['x-task-id'] as string) || uuidv4(),
              },
              ...meta,
            };

            await sendSpanToKafka(span);
          } catch (err) {
            fastify.log.error({ err }, `[PRODUCTNAME] Failed to emit span for ${provider.name}`);
          }
        });

        return reply.status(response.status).send(data);
      } catch (err: any) {
        fastify.log.error({ err }, `[PRODUCTNAME] Upstream error for ${provider.name}`);
        return reply.status(502).send({ error: 'Upstream request failed', provider: provider.name });
      }
    });

    fastify.log.info(`[PRODUCTNAME] Registered proxy route: ${provider.routePrefix}/* -> ${provider.upstreamBase()}`);
  }

  return fastify;
}
