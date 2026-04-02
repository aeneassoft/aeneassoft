// AeneasSoft API Proxy
// Routes are auto-registered from providers.ts — add new AI providers there.
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import { sendSpanToKafka } from './kafka-producer';
import { ATPSpanSchema } from '@aeneassoft/atp-schema';
import { PROVIDERS } from './providers';

const ZERO_DATA_RETENTION = process.env.ZERO_DATA_RETENTION === 'true';
const UPSTREAM_TIMEOUT_MS = parseInt(process.env.UPSTREAM_TIMEOUT_MS || '30000', 10);

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
    product: 'AeneasSoft',
    zdr: ZERO_DATA_RETENTION,
    providers: PROVIDERS.map((p) => p.name),
  }));

  // ── Direct ATP span ingest (for SDKs) ─────────────────────────────────────
  fastify.post('/ingest', async (request, reply) => {
    // Auth: require API key if configured (SDK sends X-API-Key header)
    const configuredKey = process.env.API_KEY;
    if (configuredKey) {
      const providedKey = request.headers['x-api-key'] as string | undefined;
      if (providedKey !== configuredKey) {
        return reply.status(401).send({ error: 'Invalid or missing API key' });
      }
    }

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
      if (subPath.includes('..')) {
        return reply.status(400).send({ error: 'Invalid path' });
      }
      const upstreamUrl = `${provider.upstreamBase()}/${subPath}`;

      // Build headers to forward
      const forwardHeaders = provider.forwardHeaders(request.headers as Record<string, any>);

      // Fix 9: Accept trace-id from caller, fallback to new UUID
      const incomingTraceId = (request.headers['x-trace-id'] as string) || uuidv4().replace(/-/g, '');
      const incomingParentSpanId = request.headers['x-parent-span-id'] as string | undefined;

      try {
        const reqBody = request.body as any;
        const isStreaming = reqBody?.stream === true;

        // Fix 10: Configurable upstream timeout (node-fetch v2 uses timeout option)
        const response = await fetch(upstreamUrl, {
          method: request.method,
          headers: forwardHeaders,
          timeout: UPSTREAM_TIMEOUT_MS,
          ...(request.method !== 'GET' && { body: JSON.stringify(reqBody) }),
        } as any);

        // ── Streaming: pipe SSE directly to client, no buffering ──
        if (isStreaming && response.body) {
          reply.raw.writeHead(response.status, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            'connection': 'keep-alive',
            'transfer-encoding': 'chunked',
          });

          // Collect chunks for span emission while streaming through
          const chunks: Buffer[] = [];
          response.body.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
            reply.raw.write(chunk);
          });

          response.body.on('end', () => {
            reply.raw.end();
            const latencyMs = Date.now() - startTime;

            // Parse SSE to extract final usage from [DONE] or usage chunk
            setImmediate(async () => {
              try {
                const fullText = Buffer.concat(chunks).toString('utf-8');
                // Extract last data line before [DONE] for usage info
                const dataLines = fullText.split('\n').filter(l => l.startsWith('data: ') && !l.includes('[DONE]'));
                const lastLine = dataLines[dataLines.length - 1];
                let usageData: any = null;
                if (lastLine) {
                  try { usageData = JSON.parse(lastLine.replace('data: ', '')); } catch { /* ignore */ }
                }

                const meta = provider.extractMeta(reqBody, usageData || {}, latencyMs, ZERO_DATA_RETENTION);
                const span: Record<string, unknown> = {
                  trace_id: incomingTraceId,
                  span_id: uuidv4().replace(/-/g, '').substring(0, 16),
                  ...(incomingParentSpanId ? { parent_span_id: incomingParentSpanId } : {}),
                  kind: 'CLIENT' as const,
                  start_time_unix_nano: startTime * 1_000_000,
                  end_time_unix_nano: (startTime + latencyMs) * 1_000_000,
                  status: { code: (response.ok ? 'OK' : 'ERROR') as 'OK' | 'ERROR' },
                  agent_id: `proxy-${provider.name}`,
                  agent_name: 'AeneasSoft Proxy',
                  agent_role: 'Interceptor',
                  cost_attribution: { task_id: (request.headers['x-task-id'] as string) || uuidv4() },
                  ...meta,
                };
                await sendSpanToKafka(span);
              } catch (err) {
                fastify.log.error({ err }, `AeneasSoft Failed to emit streaming span for ${provider.name}`);
              }
            });
          });

          response.body.on('error', (err: Error) => {
            fastify.log.error({ err }, `AeneasSoft Stream error for ${provider.name}`);
            if (!reply.raw.writableEnded) reply.raw.end();
          });

          return; // Fastify must not touch the response — we're writing raw
        }

        // ── Non-streaming: buffer, parse, forward ──
        // Limit response body to 2MB to prevent OOM on large error pages
        const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
        const buffer = await response.buffer();
        const rawText = buffer.length > MAX_RESPONSE_BYTES
          ? buffer.slice(0, MAX_RESPONSE_BYTES).toString('utf-8')
          : buffer.toString('utf-8');
        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch {
          // Non-JSON response (HTML error page, plain text, etc.) — forward as-is
          return reply.status(response.status).send(rawText);
        }
        const latencyMs = Date.now() - startTime;

        // Emit span asynchronously — never blocks the response
        setImmediate(async () => {
          try {
            const meta = provider.extractMeta(
              reqBody,
              data,
              latencyMs,
              ZERO_DATA_RETENTION
            );

            const span: Record<string, unknown> = {
              trace_id: incomingTraceId,
              span_id: uuidv4().replace(/-/g, '').substring(0, 16),
              ...(incomingParentSpanId ? { parent_span_id: incomingParentSpanId } : {}),
              kind: 'CLIENT' as const,
              start_time_unix_nano: startTime * 1_000_000,
              end_time_unix_nano: (startTime + latencyMs) * 1_000_000,
              status: { code: (response.ok ? 'OK' : 'ERROR') as 'OK' | 'ERROR' },
              agent_id: `proxy-${provider.name}`,
              agent_name: 'AeneasSoft Proxy',
              agent_role: 'Interceptor',
              cost_attribution: {
                task_id: (request.headers['x-task-id'] as string) || uuidv4(),
              },
              ...meta,
            };

            await sendSpanToKafka(span);
          } catch (err) {
            fastify.log.error({ err }, `AeneasSoft Failed to emit span for ${provider.name}`);
          }
        });

        return reply.status(response.status).send(data);
      } catch (err: any) {
        const endTime = Date.now();
        const latencyMs = endTime - startTime;
        const isTimeout = err?.type === 'request-timeout' || err?.name === 'AbortError';
        const message = isTimeout ? `Upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms` : (err?.message || 'Unknown error');

        fastify.log.error({ err }, `AeneasSoft Upstream error for ${provider.name}: ${message}`);

        // Fix 10: Emit error span for upstream failures
        setImmediate(async () => {
          try {
            const errorSpan: Record<string, unknown> = {
              trace_id: incomingTraceId,
              span_id: uuidv4().replace(/-/g, '').substring(0, 16),
              ...(incomingParentSpanId ? { parent_span_id: incomingParentSpanId } : {}),
              name: `${provider.name.toLowerCase()}.error`,
              kind: 'CLIENT' as const,
              start_time_unix_nano: startTime * 1_000_000,
              end_time_unix_nano: endTime * 1_000_000,
              status: { code: 'ERROR' as const, message },
              agent_id: `proxy-${provider.name}`,
              agent_name: 'AeneasSoft Proxy',
              agent_role: 'Interceptor',
              model_inference: { provider: provider.name, latency_ms: latencyMs },
            };
            await sendSpanToKafka(errorSpan);
          } catch { /* never crash */ }
        });

        return reply.status(isTimeout ? 504 : 502).send({
          error: isTimeout ? 'Upstream timeout' : 'Upstream request failed',
          provider: provider.name,
        });
      }
    });

    fastify.log.info(`AeneasSoft Registered proxy route: ${provider.routePrefix}/* -> ${provider.upstreamBase()}`);
  }

  return fastify;
}
