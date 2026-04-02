# Changelog

## v0.2.1 (2026-03-30)
- Fixed: Default ingest URL changed to `https://api.aeneassoft.com/api/ingest` (was unreachable proxy)
- Fixed: `agentwatch.verify()` uses correct /health endpoint
- Fixed: Unicode emoji crash on Windows terminals
- Added: Active Defense Circuit Breaker (`CircuitBreakerException`)
- Added: `agentwatch.workflow()` context manager for per-workflow budgets
- Added: `agentwatch.agent()` now supports `budget_per_hour`, `max_error_rate`, `block_on_threshold`
- Added: `agentwatch.verify()` diagnostic function

## v0.1.0 (2026-03-28)
- Initial release
- Universal HTTP interceptor (httpx, requests, aiohttp)
- OpenAI + Anthropic SDK patchers
- 9+ AI provider auto-detection
- `agentwatch.trace()`, `agentwatch.span()`, `agentwatch.agent()` context managers
- Zero Data Retention mode
- Fire-and-forget span emission
