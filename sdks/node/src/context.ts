// AeneasSoft Node.js Trace Context
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

// ── SDK-active flag for dedup (per-request, async-safe) ──────────────────────
// When true, the HTTP interceptor skips the current request
// (because the SDK patcher already handles it). Works regardless of hostname.
// Uses AsyncLocalStorage so concurrent requests don't interfere.
const sdkActiveStorage = new AsyncLocalStorage<{ active: boolean }>();

export function setSdkActive(active: boolean): void {
  const store = sdkActiveStorage.getStore();
  if (store) {
    store.active = active;
  }
}

export function isSdkActive(): boolean {
  return sdkActiveStorage.getStore()?.active === true;
}

export function runWithSdkActive<T>(fn: () => T): T {
  return sdkActiveStorage.run({ active: true }, fn);
}
