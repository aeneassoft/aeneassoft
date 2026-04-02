// AeneasSoft Node.js Universal HTTP Interceptor
// Patches node:https and node:http at the core level.
// Every HTTP library (axios, node-fetch, undici, got, etc.)
// eventually calls these — making this truly framework-agnostic.

import * as https from 'https';
import * as http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { currentTraceId, currentSpanId, isSdkActive } from './context';
import { sanitizeSpan } from './sanitize';

// ── Config (set by init()) ────────────────────────────────────────────────────
let _ingestUrl = 'https://api.aeneassoft.com/api/ingest';
let _apiKey = '';
let _zdr = false;
let _installed = false;

export function configureInterceptor(ingestUrl: string, apiKey: string, zdr: boolean): void {
  _ingestUrl = ingestUrl;
  _apiKey = apiKey;
  _zdr = zdr;
}

// ── Provider registry ─────────────────────────────────────────────────────────
type ProviderFormat = 'openai' | 'anthropic' | 'gemini' | 'cohere' | 'openai_compat';

const PROVIDERS: Array<[string, string, ProviderFormat]> = [
  ['api.openai.com',                    'OpenAI',       'openai'],
  ['api.anthropic.com',                 'Anthropic',    'anthropic'],
  ['generativelanguage.googleapis.com', 'Gemini',       'gemini'],
  ['api.mistral.ai',                    'Mistral',      'openai_compat'],
  ['api.cohere.com',                    'Cohere',       'cohere'],
  ['api.groq.com',                      'Groq',         'openai_compat'],
  ['api.together.xyz',                  'Together AI',  'openai_compat'],
  ['api.fireworks.ai',                  'Fireworks',    'openai_compat'],
  ['localhost:11434',                   'Ollama',       'openai_compat'],
];

// Kept for backwards compatibility but dedup now uses context flag (isSdkActive)
const SDK_PATCHED_HOSTS = new Set<string>();

export function markSdkHandled(host: string): void {
  SDK_PATCHED_HOSTS.add(host);
}

function detectProvider(hostname: string): [string, ProviderFormat] | null {
  // Azure OpenAI
  if (/\.openai\.azure\.com/i.test(hostname)) return ['Azure OpenAI', 'openai_compat'];
  for (const [host, provider, fmt] of PROVIDERS) {
    if (hostname.includes(host)) return [provider, fmt];
  }
  return null;
}

function isSdkHandled(hostname: string): boolean {
  for (const h of SDK_PATCHED_HOSTS) {
    if (hostname.includes(h)) return true;
  }
  return false;
}

// ── Body parsing ──────────────────────────────────────────────────────────────

function safeParseJson(data: string | Buffer): Record<string, unknown> | null {
  try {
    const str = Buffer.isBuffer(data) ? data.toString('utf8') : data;
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function extractModel(reqBody: string): string | undefined {
  const parsed = safeParseJson(reqBody);
  return (parsed?.model as string) ?? (parsed?.modelId as string) ?? undefined;
}

function extractTokens(respBody: string, fmt: ProviderFormat): [number, number] {
  const parsed = safeParseJson(respBody);
  if (!parsed) return [0, 0];
  try {
    if (fmt === 'openai' || fmt === 'openai_compat') {
      const u = parsed.usage as Record<string, number> | undefined;
      return [u?.prompt_tokens ?? 0, u?.completion_tokens ?? 0];
    }
    if (fmt === 'anthropic') {
      const u = parsed.usage as Record<string, number> | undefined;
      return [u?.input_tokens ?? 0, u?.output_tokens ?? 0];
    }
    if (fmt === 'gemini') {
      const m = parsed.usageMetadata as Record<string, number> | undefined;
      return [m?.promptTokenCount ?? 0, m?.candidatesTokenCount ?? 0];
    }
    if (fmt === 'cohere') {
      const bu = ((parsed.meta as Record<string, unknown>)?.billed_units as Record<string, number>) ?? {};
      return [bu.input_tokens ?? 0, bu.output_tokens ?? 0];
    }
  } catch { /* fall through */ }
  return [0, 0];
}

function extractOutput(respBody: string, fmt: ProviderFormat): string | undefined {
  const parsed = safeParseJson(respBody);
  if (!parsed) return undefined;
  try {
    if (fmt === 'openai' || fmt === 'openai_compat') {
      return (parsed.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content;
    }
    if (fmt === 'anthropic') {
      return (parsed.content as Array<{ text: string }>)?.[0]?.text;
    }
    if (fmt === 'gemini') {
      return ((parsed.candidates as Array<{ content: { parts: Array<{ text: string }> } }>)?.[0]
        ?.content?.parts?.[0]?.text);
    }
  } catch { /* fall through */ }
  return undefined;
}

function extractInput(reqBody: string): string | undefined {
  const parsed = safeParseJson(reqBody);
  if (!parsed) return undefined;
  const messages = parsed.messages as Array<{ content: unknown }> | undefined;
  if (messages?.length) {
    const last = messages[messages.length - 1];
    return typeof last.content === 'string' ? last.content.slice(0, 2000) : undefined;
  }
  return (parsed.prompt as string)?.slice(0, 2000);
}

// ── Span emission ─────────────────────────────────────────────────────────────

function emitSpan(
  provider: string,
  fmt: ProviderFormat,
  reqBody: string,
  respBody: string,
  statusCode: number,
  startMs: number,
  endMs: number,
): void {
  // Fire-and-forget — never blocks
  setImmediate(() => {
    try {
      const [promptTokens, completionTokens] = extractTokens(respBody, fmt);
      const span: Record<string, unknown> = {
        trace_id: currentTraceId() ?? uuidv4().replace(/-/g, ''),
        span_id: uuidv4().replace(/-/g, '').substring(0, 16),
        name: `${provider.toLowerCase().replace(/ /g, '_')}.http`,
        kind: 'CLIENT',
        start_time_unix_nano: startMs * 1_000_000,
        end_time_unix_nano: endMs * 1_000_000,
        status: { code: statusCode > 0 && statusCode < 400 ? 'OK' : 'ERROR' },
        agent_id: 'node-interceptor',
        agent_name: 'AeneasSoft Universal Interceptor',
        agent_role: 'AutoInstrumented',
        model_inference: {
          model_name: extractModel(reqBody),
          provider,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          latency_ms: endMs - startMs,
        },
      };

      const parentSpanId = currentSpanId();
      if (parentSpanId) span.parent_span_id = parentSpanId;

      const input = extractInput(reqBody);
      const output = extractOutput(respBody, fmt);
      if (input) span.input = input;
      if (output) span.output = output;

      sanitizeSpan(span, _zdr);

      fetch(_ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AeneasSoft-API-Key': _apiKey,
        },
        body: JSON.stringify(span),
        signal: AbortSignal.timeout(100), // max 100ms, then drop
      }).catch(() => { /* observability must never crash host */ });
    } catch { /* never throw */ }
  });
}

// ── Core http/https patch ─────────────────────────────────────────────────────

function patchModule(mod: typeof http | typeof https): void {
  const originalRequest = mod.request.bind(mod);

  function patchedRequest(
    urlOrOptions: string | URL | http.RequestOptions,
    optionsOrCallback?: http.RequestOptions | ((res: http.IncomingMessage) => void),
    callback?: (res: http.IncomingMessage) => void,
  ): http.ClientRequest {
    // Determine hostname
    let hostname = '';
    try {
      if (typeof urlOrOptions === 'string') {
        hostname = new URL(urlOrOptions).hostname;
      } else if (urlOrOptions instanceof URL) {
        hostname = urlOrOptions.hostname;
      } else {
        hostname = (urlOrOptions as http.RequestOptions).hostname ?? '';
      }
    } catch { /* ignore */ }

    const providerInfo = detectProvider(hostname);

    // Pass through if: not an AI provider, SDK patcher is active (context flag), or host is SDK-handled
    if (!providerInfo || isSdkActive() || isSdkHandled(hostname)) {
      return (originalRequest as Function)(urlOrOptions, optionsOrCallback, callback);
    }

    const [provider, fmt] = providerInfo;
    const startMs = Date.now();
    const reqChunks: Buffer[] = [];
    let respChunks: Buffer[] = [];
    let statusCode = 0;
    let reqBytes = 0;
    let respBytes = 0;
    const MAX_BUFFER = 65_536; // 64 KB — stop collecting after this

    // Make the real request
    const req: http.ClientRequest = (originalRequest as Function)(
      urlOrOptions,
      optionsOrCallback,
      callback,
    );

    // Capture outgoing body (with buffer limit)
    const origWrite = req.write.bind(req);
    const origEnd = req.end.bind(req);

    req.write = function (chunk: unknown, ...args: unknown[]) {
      if (chunk && reqBytes < MAX_BUFFER) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
        reqChunks.push(buf);
        reqBytes += buf.length;
      }
      return (origWrite as Function)(chunk, ...args);
    };

    req.end = function (chunk?: unknown, ...args: unknown[]) {
      if (chunk && reqBytes < MAX_BUFFER) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
        reqChunks.push(buf);
        reqBytes += buf.length;
      }
      return (origEnd as Function)(chunk, ...args);
    };

    // Capture incoming response (with buffer limit + SSE skip)
    req.on('response', (res: http.IncomingMessage) => {
      statusCode = res.statusCode ?? 0;
      const contentType = res.headers['content-type'] || '';
      const isSSE = contentType.includes('text/event-stream');

      res.on('data', (chunk: Buffer) => {
        // Skip body collection for SSE/streaming — prevents RAM bloat
        if (!isSSE && respBytes < MAX_BUFFER) {
          respChunks.push(chunk);
          respBytes += chunk.length;
        }
      });
      res.on('end', () => {
        const endMs = Date.now();
        const reqBody = Buffer.concat(reqChunks).toString('utf8');
        const respBody = isSSE ? '' : Buffer.concat(respChunks).toString('utf8');
        emitSpan(provider, fmt, reqBody, respBody, statusCode, startMs, endMs);
      });
    });

    return req;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mod as any).request = patchedRequest;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function installInterceptor(): void {
  if (_installed) return; // idempotent
  _installed = true;
  patchModule(https);
  patchModule(http);
}
