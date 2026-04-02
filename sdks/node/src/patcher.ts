// AeneasSoft Node.js SDK — Auto-instrumentation
// Monkey-patches openai and @anthropic-ai/sdk at the prototype level.
// Works with LangChain.js, any framework that uses these libraries,
// and OpenClaw (via proxy base_url config).
import { v4 as uuidv4 } from 'uuid';
import { currentTraceId, currentSpanId, runWithSdkActive } from './context';
import { sanitizeSpan } from './sanitize';

let _ingestUrl = 'https://api.aeneassoft.com/api/ingest';
let _apiKey = '';
let _zdr = false;

// Idempotency guards (Fix 8)
let _openaiPatched = false;
let _anthropicPatched = false;

export function configure(ingestUrl: string, apiKey: string, zdr: boolean): void {
  _ingestUrl = ingestUrl;
  _apiKey = apiKey;
  _zdr = zdr;
}

// Fire-and-forget — NEVER blocks the calling code
function sendSpan(span: Record<string, unknown>): void {
  setImmediate(() => {
    fetch(_ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AeneasSoft-API-Key': _apiKey,
      },
      body: JSON.stringify(span),
      signal: AbortSignal.timeout(500),
    }).catch(() => {
      // Observability must NEVER crash the host app
    });
  });
}

function buildBaseSpan(name: string, startMs: number, endMs: number, ok: boolean) {
  const tid = currentTraceId() ?? uuidv4().replace(/-/g, '');
  const sid = uuidv4().replace(/-/g, '').substring(0, 16);
  const parentSid = currentSpanId();

  return {
    trace_id: tid,
    span_id: sid,
    ...(parentSid ? { parent_span_id: parentSid } : {}),
    name,
    kind: 'CLIENT' as const,
    start_time_unix_nano: startMs * 1_000_000,
    end_time_unix_nano: endMs * 1_000_000,
    status: { code: ok ? 'OK' : 'ERROR' } as { code: 'OK' | 'ERROR' },
    agent_id: 'node-sdk',
    agent_name: 'AeneasSoft Node.js SDK',
    agent_role: 'AutoInstrumented',
  };
}

// ── OpenAI patch ──────────────────────────────────────────────────────────────
export function patchOpenAI(): void {
  if (_openaiPatched) return; // Fix 8: idempotent
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const openaiModule = require('openai');
    const Completions = openaiModule?.default?.Chat?.Completions
      ?? openaiModule?.OpenAI?.Chat?.Completions;

    if (!Completions?.prototype?.create) {
      console.warn('AeneasSoft openai: could not find Completions.prototype.create');
      return;
    }

    const original = Completions.prototype.create;

    Completions.prototype.create = async function (
      this: unknown,
      params: Record<string, unknown>,
      options?: unknown
    ) {
      return runWithSdkActive(async () => {
        const start = Date.now();
        try {
          const response = await original.call(this, params, options);
          const end = Date.now();

          const r = response as Record<string, unknown>;
          const usage = r.usage as Record<string, number> | undefined;

          sendSpan(sanitizeSpan({
            ...buildBaseSpan('openai.chat.completion', start, end, true),
            input: JSON.stringify((params.messages as unknown[])?.slice(-1)),
            output: ((r.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content),
            model_inference: {
              model_name: r.model ?? params.model,
              provider: 'OpenAI',
              prompt_tokens: usage?.prompt_tokens,
              completion_tokens: usage?.completion_tokens,
              latency_ms: end - start,
            },
          }, _zdr));

          return response;
        } catch (err: any) {
          const end = Date.now();
          sendSpan({
            ...buildBaseSpan('openai.chat.completion', start, end, false),
            status: { code: 'ERROR', message: err?.message || 'Unknown error' },
            model_inference: {
              model_name: params.model as string,
              provider: 'OpenAI',
              latency_ms: end - start,
            },
          });
          throw err;
        }
      });
    };

    _openaiPatched = true;
    console.log('AeneasSoft openai patched successfully');
  } catch {
    // openai not installed — fine
  }
}

// ── Anthropic patch ───────────────────────────────────────────────────────────
export function patchAnthropic(): void {
  if (_anthropicPatched) return; // Fix 8: idempotent
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const anthropicModule = require('@anthropic-ai/sdk');
    const Messages = anthropicModule?.default?.Messages
      ?? anthropicModule?.Anthropic?.Messages;

    if (!Messages?.prototype?.create) {
      console.warn('AeneasSoft @anthropic-ai/sdk: could not find Messages.prototype.create');
      return;
    }

    const original = Messages.prototype.create;

    Messages.prototype.create = async function (
      this: unknown,
      params: Record<string, unknown>,
      options?: unknown
    ) {
      return runWithSdkActive(async () => {
        const start = Date.now();
        try {
          const response = await original.call(this, params, options);
          const end = Date.now();

          const r = response as Record<string, unknown>;
          const usage = r.usage as Record<string, number> | undefined;

          sendSpan(sanitizeSpan({
            ...buildBaseSpan('anthropic.messages.create', start, end, true),
            input: JSON.stringify((params.messages as unknown[])?.slice(-1)),
            output: ((r.content as Array<{ text: string }>)?.[0]?.text),
            model_inference: {
              model_name: r.model ?? params.model,
              provider: 'Anthropic',
              prompt_tokens: usage?.input_tokens,
              completion_tokens: usage?.output_tokens,
              latency_ms: end - start,
            },
          }, _zdr));

          return response;
        } catch (err: any) {
          const end = Date.now();
          sendSpan({
            ...buildBaseSpan('anthropic.messages.create', start, end, false),
            status: { code: 'ERROR', message: err?.message || 'Unknown error' },
            model_inference: {
              model_name: params.model as string,
              provider: 'Anthropic',
              latency_ms: end - start,
            },
          });
          throw err;
        }
      });
    };

    _anthropicPatched = true;
    console.log('AeneasSoft @anthropic-ai/sdk patched successfully');
  } catch {
    // anthropic not installed — fine
  }
}
