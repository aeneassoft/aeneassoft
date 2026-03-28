// [PRODUCTNAME] Node.js SDK
// USB-Stick Principle: 2 lines, everything works.
//
// Usage:
//   import { init } from '@productname/sdk-node';
//   init({ apiKey: 'your-key' });
//
// With trace grouping (LangChain, AutoGen, OpenClaw, etc.):
//   import { init, trace, span } from '@productname/sdk-node';
//   init({ apiKey: 'your-key' });
//   await trace('my-agent-run', { agentId: 'agent-1' }, async (traceId) => {
//     const result = await openai.chat.completions.create({ ... });
//   });

import { v4 as uuidv4 } from 'uuid';
import { configure, patchOpenAI, patchAnthropic } from './patcher';
import { runWithContext, currentTraceId, newSpanId } from './context';

export { currentTraceId };

export interface InitOptions {
  apiKey: string;
  ingestUrl?: string;
  zeroDataRetention?: boolean;
}

export function init(options: InitOptions): void {
  const { apiKey, ingestUrl = 'http://localhost:8080/ingest', zeroDataRetention = false } = options;
  configure(ingestUrl, apiKey, zeroDataRetention);
  patchOpenAI();
  patchAnthropic();
}

export interface TraceOptions {
  agentId?: string;
  agentName?: string;
  agentRole?: string;
  traceId?: string;
}

// ── trace() — groups all LLM calls inside the callback into one trace ─────────
export async function trace<T>(
  name: string,
  options: TraceOptions,
  fn: (traceId: string) => Promise<T>
): Promise<T> {
  const traceId = options.traceId ?? uuidv4().replace(/-/g, '');
  const rootSpanId = newSpanId();

  return runWithContext({ traceId, spanId: rootSpanId }, () => fn(traceId));
}

// ── span() — manual span for non-LLM actions (tool calls, browser, etc.) ─────
export async function span<T>(
  name: string,
  options: {
    agentId?: string;
    agentName?: string;
    agentRole?: string;
    ingestUrl?: string;
    apiKey?: string;
  },
  fn: (spanId: string) => Promise<T>
): Promise<T> {
  const parentTraceId = currentTraceId() ?? uuidv4().replace(/-/g, '');
  const spanId = newSpanId();
  const start = Date.now();

  return runWithContext({ traceId: parentTraceId, spanId }, async () => {
    try {
      const result = await fn(spanId);
      return result;
    } finally {
      // span completion tracked by caller if needed
      void start; // suppress unused warning
    }
  });
}
