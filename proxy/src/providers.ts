// AeneasSoft Provider Registry
// Add a new AI provider here — no other files need to change.
//
// Each entry defines:
//   routePrefix   — URL prefix this proxy listens on  (e.g. "/openai")
//   upstreamBase  — upstream API base URL (from env var with fallback)
//   forwardHeaders — which request headers to forward upstream
//   extractMeta   — how to read model / tokens / cost from the upstream response

import { v4 as uuidv4 } from 'uuid';

// Cap input/output to prevent ClickHouse bloat + PII risk (matches Node SDK 2000-char limit)
const MAX_FIELD_LEN = 2000;
function cap(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  return s.length > MAX_FIELD_LEN ? s.slice(0, MAX_FIELD_LEN) + '…[truncated]' : s;
}

export interface ProviderConfig {
  name: string;
  routePrefix: string;
  upstreamBase: () => string;
  forwardHeaders: (reqHeaders: Record<string, any>) => Record<string, string>;
  extractMeta: (
    reqBody: any,
    resBody: any,
    latencyMs: number,
    zdr: boolean
  ) => ProviderSpanMeta;
}

export interface ProviderSpanMeta {
  name: string;
  input?: string;
  output?: string;
  model_inference: {
    model_name?: string;
    provider: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    latency_ms: number;
  };
}

// ─── Registered Providers ──────────────────────────────────────────────────
// To add a new provider (e.g. Gemini, Cohere, Mistral, Ollama):
//   1. Add a new entry to this array
//   2. Add UPSTREAM_<NAME>_URL to .env.example
//   That's it — the proxy auto-registers the route.

export const PROVIDERS: ProviderConfig[] = [
  // ── OpenAI ────────────────────────────────────────────────────────────────
  {
    name: 'openai',
    routePrefix: '/openai',
    upstreamBase: () => process.env.UPSTREAM_OPENAI_URL || 'https://api.openai.com',
    forwardHeaders: (h) => ({
      'Content-Type': 'application/json',
      ...(h['authorization'] ? { Authorization: h['authorization'] } : {}),
    }),
    extractMeta: (body, data, latencyMs, zdr) => ({
      name: 'openai.chat.completion',
      ...(!zdr && {
        input: cap(JSON.stringify(body?.messages?.slice(-1))),
        output: cap(data?.choices?.[0]?.message?.content),
      }),
      model_inference: {
        model_name: data?.model || body?.model,
        provider: 'OpenAI',
        prompt_tokens: data?.usage?.prompt_tokens,
        completion_tokens: data?.usage?.completion_tokens,
        latency_ms: latencyMs,
      },
    }),
  },

  // ── Anthropic ─────────────────────────────────────────────────────────────
  {
    name: 'anthropic',
    routePrefix: '/anthropic',
    upstreamBase: () => process.env.UPSTREAM_ANTHROPIC_URL || 'https://api.anthropic.com',
    forwardHeaders: (h) => ({
      'Content-Type': 'application/json',
      ...(h['x-api-key'] ? { 'x-api-key': h['x-api-key'] } : {}),
      'anthropic-version': h['anthropic-version'] || '2023-06-01',
    }),
    extractMeta: (body, data, latencyMs, zdr) => ({
      name: 'anthropic.messages.create',
      ...(!zdr && {
        input: cap(JSON.stringify(body?.messages?.slice(-1))),
        output: cap(data?.content?.[0]?.text),
      }),
      model_inference: {
        model_name: data?.model || body?.model,
        provider: 'Anthropic',
        prompt_tokens: data?.usage?.input_tokens,
        completion_tokens: data?.usage?.output_tokens,
        latency_ms: latencyMs,
      },
    }),
  },

  // ── Google Gemini ─────────────────────────────────────────────────────────
  // Uncomment when needed:
  // {
  //   name: 'gemini',
  //   routePrefix: '/gemini',
  //   upstreamBase: () => process.env.UPSTREAM_GEMINI_URL || 'https://generativelanguage.googleapis.com',
  //   forwardHeaders: (h) => ({
  //     'Content-Type': 'application/json',
  //     ...(h['x-goog-api-key'] ? { 'x-goog-api-key': h['x-goog-api-key'] } : {}),
  //   }),
  //   extractMeta: (body, data, latencyMs, zdr) => ({
  //     name: 'gemini.generate_content',
  //     ...(!zdr && {
  //       input: cap(JSON.stringify(body?.contents?.slice(-1))),
  //       output: cap(data?.candidates?.[0]?.content?.parts?.[0]?.text),
  //     }),
  //     model_inference: {
  //       model_name: body?.model,
  //       provider: 'Google',
  //       prompt_tokens: data?.usageMetadata?.promptTokenCount,
  //       completion_tokens: data?.usageMetadata?.candidatesTokenCount,
  //       latency_ms: latencyMs,
  //     },
  //   }),
  // },

  // ── Cohere ────────────────────────────────────────────────────────────────
  // Uncomment when needed:
  // {
  //   name: 'cohere',
  //   routePrefix: '/cohere',
  //   upstreamBase: () => process.env.UPSTREAM_COHERE_URL || 'https://api.cohere.ai',
  //   forwardHeaders: (h) => ({
  //     'Content-Type': 'application/json',
  //     ...(h['authorization'] ? { Authorization: h['authorization'] } : {}),
  //   }),
  //   extractMeta: (body, data, latencyMs, zdr) => ({
  //     name: 'cohere.chat',
  //     ...(!zdr && { input: cap(body?.message), output: cap(data?.text) }),
  //     model_inference: {
  //       model_name: body?.model || data?.meta?.billed_units ? 'command' : undefined,
  //       provider: 'Cohere',
  //       prompt_tokens: data?.meta?.billed_units?.input_tokens,
  //       completion_tokens: data?.meta?.billed_units?.output_tokens,
  //       latency_ms: latencyMs,
  //     },
  //   }),
  // },
];
