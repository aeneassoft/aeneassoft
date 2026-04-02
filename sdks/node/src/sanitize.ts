// AeneasSoft — Centralized span sanitizer
// Single source of truth for ZDR (Zero Data Retention) and field truncation.

const MAX_FIELD_LEN = 2000;

export function sanitizeSpan(
  span: Record<string, unknown>,
  zdr: boolean,
): Record<string, unknown> {
  if (zdr) {
    // Strip all PII-carrying fields when Zero Data Retention is enabled
    delete span.input;
    delete span.output;
    delete span.decision_reasoning;
  } else {
    // Truncate to prevent storage bloat
    if (typeof span.input === 'string' && span.input.length > MAX_FIELD_LEN) {
      span.input = span.input.slice(0, MAX_FIELD_LEN) + '…[truncated]';
    }
    if (typeof span.output === 'string' && span.output.length > MAX_FIELD_LEN) {
      span.output = span.output.slice(0, MAX_FIELD_LEN) + '…[truncated]';
    }
  }
  return span;
}
