// [PRODUCTNAME] Node.js Trace Context
// Uses AsyncLocalStorage for proper async context propagation —
// works correctly across await boundaries, Promises, and callbacks.
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

export interface TraceContext {
  traceId: string;
  spanId: string;
}

const storage = new AsyncLocalStorage<TraceContext>();

export function currentContext(): TraceContext | undefined {
  return storage.getStore();
}

export function currentTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}

export function currentSpanId(): string | undefined {
  return storage.getStore()?.spanId;
}

export function runWithContext<T>(ctx: TraceContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function newSpanId(): string {
  return uuidv4().replace(/-/g, '').substring(0, 16);
}
