"""
AeneasSoft Universal HTTP Interceptor
Patches httpx, requests, and aiohttp at the transport level.
Intercepts all outgoing HTTP calls to known AI providers —
regardless of which framework is used above.

Framework-agnostic. Works with LangChain, CrewAI, AutoGen,
LlamaIndex, Groq, Mistral, Gemini, and any custom code.
"""
import json
import re
import time
import threading
import uuid
from typing import Any, Dict, Optional, Tuple

# ── Provider registry ──────────────────────────────────────────────────────────
# (hostname_substring, provider_name, response_format)
_PROVIDERS: list = [
    ("api.openai.com",                   "OpenAI",       "openai"),
    ("api.anthropic.com",                "Anthropic",    "anthropic"),
    ("generativelanguage.googleapis.com","Gemini",       "gemini"),
    ("api.mistral.ai",                   "Mistral",      "openai_compat"),
    ("api.cohere.com",                   "Cohere",       "cohere"),
    ("api.groq.com",                     "Groq",         "openai_compat"),
    ("api.together.xyz",                 "Together AI",  "openai_compat"),
    ("api.fireworks.ai",                 "Fireworks",    "openai_compat"),
    ("localhost:11434",                  "Ollama",       "openai_compat"),
]
_AZURE_RE = re.compile(r"\.openai\.azure\.com", re.IGNORECASE)

# Hosts whose SDK-level patchers are active — prevents duplicate spans
_sdk_patched_hosts: set = set()

# ── Model pricing (USD per 1M tokens) ────────────────────────────────────────
# (prompt_price_per_1M, completion_price_per_1M)
MODEL_PRICES: Dict[str, Tuple[float, float]] = {
    "gpt-4o":                       (5.0, 15.0),
    "gpt-4o-mini":                  (0.15, 0.6),
    "gpt-4-turbo":                  (10.0, 30.0),
    "gpt-4":                        (30.0, 60.0),
    "gpt-3.5-turbo":                (0.5, 1.5),
    "claude-opus-4-6":              (15.0, 75.0),
    "claude-sonnet-4-6":            (3.0, 15.0),
    "claude-haiku-4-5":             (0.8, 4.0),
    "claude-3-5-sonnet-20241022":   (3.0, 15.0),
    "claude-3-5-haiku-20241022":    (1.0, 5.0),
    "gemini-1.5-pro":               (3.5, 10.5),
    "gemini-1.5-flash":             (0.075, 0.3),
    "mistral-large-latest":         (4.0, 12.0),
    "mistral-small-latest":         (1.0, 3.0),
    "llama3-70b-8192":              (0.59, 0.79),
    "llama3-8b-8192":               (0.05, 0.08),
    "mixtral-8x7b-32768":           (0.24, 0.24),
    "command-r-plus":               (3.0, 15.0),
    "command-r":                    (0.5, 1.5),
}
_DEFAULT_PRICE: Tuple[float, float] = (1.0, 2.0)  # fallback for unknown models


def _calculate_cost(model: Optional[str], prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate USD cost from model name and token counts."""
    if not model:
        p_price, c_price = _DEFAULT_PRICE
    else:
        # Try exact match first, then prefix match for versioned models
        p_price, c_price = MODEL_PRICES.get(model, (0.0, 0.0))
        if p_price == 0.0 and c_price == 0.0:
            for key, prices in MODEL_PRICES.items():
                if model.startswith(key) or key.startswith(model):
                    p_price, c_price = prices
                    break
            else:
                p_price, c_price = _DEFAULT_PRICE
    return (prompt_tokens * p_price + completion_tokens * c_price) / 1_000_000

# Thread-local: set True while SDK-level patcher is executing
_local = threading.local()


# ── Provider detection ─────────────────────────────────────────────────────────

def _detect_provider(url: str) -> Optional[Tuple[str, str]]:
    if _AZURE_RE.search(url):
        return ("Azure OpenAI", "openai_compat")
    for host, provider, fmt in _PROVIDERS:
        if host in url:
            return (provider, fmt)
    return None


def _is_sdk_active() -> bool:
    return getattr(_local, "sdk_active", False)


# ── Body parsing helpers ───────────────────────────────────────────────────────

def _parse_json(data: Any) -> Optional[dict]:
    if isinstance(data, dict):
        return data
    try:
        if isinstance(data, (bytes, bytearray)):
            return json.loads(data.decode("utf-8", errors="replace"))
        if isinstance(data, str):
            return json.loads(data)
    except Exception:
        pass
    return None


def _extract_model(req_body: Any) -> Optional[str]:
    parsed = _parse_json(req_body)
    if not parsed:
        return None
    return parsed.get("model") or parsed.get("modelId") or parsed.get("model_id")


def _extract_input(req_body: Any) -> Optional[str]:
    parsed = _parse_json(req_body)
    if not parsed:
        return None
    messages = parsed.get("messages") or []
    if messages:
        last = messages[-1]
        if isinstance(last, dict):
            content = last.get("content", "")
            if isinstance(content, list):
                # Anthropic multi-part content
                parts = [p.get("text", "") for p in content if isinstance(p, dict)]
                return " ".join(parts)[:2000]
            return str(content)[:2000]
    return (parsed.get("prompt") or parsed.get("input") or "")[:2000] or None


def _extract_output(resp_body: Any, fmt: str) -> Optional[str]:
    parsed = _parse_json(resp_body)
    if not parsed:
        return None
    try:
        if fmt in ("openai", "openai_compat"):
            return parsed["choices"][0]["message"]["content"]
        if fmt == "anthropic":
            return parsed["content"][0]["text"]
        if fmt == "gemini":
            return parsed["candidates"][0]["content"]["parts"][0]["text"]
        if fmt == "cohere":
            return parsed.get("text") or parsed.get("message", {}).get("content", [{}])[0].get("text")
    except (KeyError, IndexError, TypeError):
        pass
    return None


def _extract_tokens(resp_body: Any, fmt: str) -> Tuple[int, int]:
    parsed = _parse_json(resp_body)
    if not parsed:
        return 0, 0
    try:
        if fmt in ("openai", "openai_compat"):
            u = parsed.get("usage") or {}
            return u.get("prompt_tokens", 0), u.get("completion_tokens", 0)
        if fmt == "anthropic":
            u = parsed.get("usage") or {}
            return u.get("input_tokens", 0), u.get("output_tokens", 0)
        if fmt == "gemini":
            m = parsed.get("usageMetadata") or {}
            return m.get("promptTokenCount", 0), m.get("candidatesTokenCount", 0)
        if fmt == "cohere":
            bu = (parsed.get("meta") or {}).get("billed_units") or {}
            return bu.get("input_tokens", 0), bu.get("output_tokens", 0)
    except Exception:
        pass
    return 0, 0


# ── Span emission ──────────────────────────────────────────────────────────────

def _emit(
    url: str,
    provider: str,
    fmt: str,
    req_body: Any,
    resp_body: Any,
    status_code: int,
    start: float,
    end: float,
) -> None:
    """Build an ATP span and fire-and-forget it. Never raises."""
    try:
        from agentwatch.patcher import _send_span_async, _zero_data_retention
        from agentwatch.context import current_trace_id, current_span_id, current_agent

        agent_ctx = current_agent()
        prompt_tokens, completion_tokens = _extract_tokens(resp_body, fmt)
        model = _extract_model(req_body)

        span: Dict[str, Any] = {
            "trace_id": current_trace_id() or uuid.uuid4().hex,
            "span_id": uuid.uuid4().hex[:16],
            "name": f"{provider.lower().replace(' ', '_')}.http",
            "kind": "CLIENT",
            "start_time_unix_nano": int(start * 1e9),
            "end_time_unix_nano": int(end * 1e9),
            "status": {"code": "OK" if 0 < status_code < 400 else "ERROR"},
            "agent_id": agent_ctx.get("agent_id", "http-interceptor"),
            "agent_name": agent_ctx.get("agent_name", "AeneasSoft Universal Interceptor"),
            "agent_role": agent_ctx.get("agent_role", "AutoInstrumented"),
            "model_inference": {
                "model_name": model,
                "provider": provider,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "latency_ms": int((end - start) * 1000),
            },
        }

        parent = current_span_id()
        if parent:
            span["parent_span_id"] = parent

        if not _zero_data_retention:
            inp = _extract_input(req_body)
            out = _extract_output(resp_body, fmt)
            if inp:
                span["input"] = inp
            if out:
                span["output"] = out[:2000]

        _send_span_async(span)
    except Exception:
        pass  # Observability must NEVER crash the host app


# ── Active Defense helpers ─────────────────────────────────────────────────────

def _check_monitors(url: str) -> None:
    """Check all active monitors (global + scoped) before a call."""
    try:
        from agentwatch.circuit_breaker import get_global_monitor
        from agentwatch.context import get_active_monitors
        get_global_monitor().check(url)
        for monitor in get_active_monitors():
            monitor.check(url)
    except Exception as e:
        from agentwatch.circuit_breaker import CircuitBreakerException
        if isinstance(e, CircuitBreakerException):
            raise
        pass  # Non-CB exceptions must not crash


def _record_monitors(cost_usd: float, is_error: bool) -> None:
    """Record result on all active monitors after a call."""
    try:
        from agentwatch.circuit_breaker import get_global_monitor
        from agentwatch.context import get_active_monitors
        get_global_monitor().record_result(cost_usd, is_error)
        for monitor in get_active_monitors():
            monitor.record_result(cost_usd, is_error)
    except Exception:
        pass


# ── httpx patch ────────────────────────────────────────────────────────────────

def _patch_httpx() -> None:
    try:
        import httpx

        _orig_sync = httpx.Client.send
        _orig_async = httpx.AsyncClient.send

        def _sync_send(self, request, **kwargs):
            url = str(request.url)
            info = _detect_provider(url)
            if not info:
                return _orig_sync(self, request, **kwargs)
            _check_monitors(url)
            if _is_sdk_active():
                return _orig_sync(self, request, **kwargs)
            provider, fmt = info
            req_body = getattr(request, "content", b"") or b""
            start = time.time()
            is_error = False
            cost_usd = 0.0
            try:
                resp = _orig_sync(self, request, **kwargs)
                end = time.time()
                is_error = resp.status_code >= 400
                resp_content = getattr(resp, "content", b"")
                _emit(url, provider, fmt, req_body, resp_content, resp.status_code, start, end)
                model = _extract_model(req_body)
                pt, ct = _extract_tokens(resp_content, fmt)
                cost_usd = _calculate_cost(model, pt, ct)
                return resp
            except Exception:
                is_error = True
                _emit(url, provider, fmt, req_body, b"", 0, start, time.time())
                raise
            finally:
                _record_monitors(cost_usd, is_error)

        async def _async_send(self, request, **kwargs):
            url = str(request.url)
            info = _detect_provider(url)
            if not info:
                return await _orig_async(self, request, **kwargs)
            _check_monitors(url)
            if _is_sdk_active():
                return await _orig_async(self, request, **kwargs)
            provider, fmt = info
            req_body = getattr(request, "content", b"") or b""
            start = time.time()
            is_error = False
            cost_usd = 0.0
            try:
                resp = await _orig_async(self, request, **kwargs)
                end = time.time()
                is_error = resp.status_code >= 400
                resp_content = getattr(resp, "content", b"")
                _emit(url, provider, fmt, req_body, resp_content, resp.status_code, start, end)
                model = _extract_model(req_body)
                pt, ct = _extract_tokens(resp_content, fmt)
                cost_usd = _calculate_cost(model, pt, ct)
                return resp
            except Exception:
                is_error = True
                _emit(url, provider, fmt, req_body, b"", 0, start, time.time())
                raise
            finally:
                _record_monitors(cost_usd, is_error)

        httpx.Client.send = _sync_send          # type: ignore[method-assign]
        httpx.AsyncClient.send = _async_send    # type: ignore[method-assign]
    except ImportError:
        pass


# ── requests patch ─────────────────────────────────────────────────────────────

def _patch_requests() -> None:
    try:
        import requests.adapters as _ra

        _orig = _ra.HTTPAdapter.send

        def _patched_send(self, request, **kwargs):
            url = request.url or ""
            info = _detect_provider(url)
            if not info or _is_sdk_active():
                return _orig(self, request, **kwargs)
            _check_monitors(url)
            provider, fmt = info
            req_body = request.body or b""
            start = time.time()
            is_error = False
            cost_usd = 0.0
            try:
                resp = _orig(self, request, **kwargs)
                end = time.time()
                is_error = resp.status_code >= 400
                resp_content = getattr(resp, "content", b"")
                _emit(url, provider, fmt, req_body, resp_content, resp.status_code, start, end)
                model = _extract_model(req_body)
                pt, ct = _extract_tokens(resp_content, fmt)
                cost_usd = _calculate_cost(model, pt, ct)
                return resp
            except Exception:
                is_error = True
                _emit(url, provider, fmt, req_body, b"", 0, start, time.time())
                raise
            finally:
                _record_monitors(cost_usd, is_error)

        _ra.HTTPAdapter.send = _patched_send    # type: ignore[method-assign]
    except ImportError:
        pass


# ── aiohttp patch ──────────────────────────────────────────────────────────────

def _patch_aiohttp() -> None:
    try:
        import aiohttp

        _orig = aiohttp.ClientSession._request

        async def _patched_request(self, method, str_or_url, **kwargs):
            url = str(str_or_url)
            info = _detect_provider(url)
            if not info or _is_sdk_active():
                return await _orig(self, method, str_or_url, **kwargs)
            _check_monitors(url)

            provider, fmt = info
            # Capture request body from json/data kwargs
            req_body: Any = kwargs.get("json") or kwargs.get("data") or b""
            if isinstance(req_body, dict):
                req_body = json.dumps(req_body).encode()

            start = time.time()
            try:
                resp = await _orig(self, method, str_or_url, **kwargs)
            except Exception:
                _emit(url, provider, fmt, req_body, b"", 0, start, time.time())
                raise

            end = time.time()

            # Wrap response.read() to capture body lazily (doesn't consume stream twice)
            _orig_read = resp.read

            async def _capturing_read() -> bytes:
                content = await _orig_read()
                _emit(url, provider, fmt, req_body, content, resp.status, start, end)
                # Restore original so subsequent reads work normally
                resp.read = _orig_read  # type: ignore[method-assign]
                return content

            resp.read = _capturing_read  # type: ignore[method-assign]
            return resp

        aiohttp.ClientSession._request = _patched_request  # type: ignore[method-assign]
    except ImportError:
        pass


# ── Public API ─────────────────────────────────────────────────────────────────

def patch_all() -> None:
    """
    Install interceptors for httpx, requests, and aiohttp.
    Called automatically by agentwatch.init().
    Idempotent — safe to call multiple times.
    """
    _patch_httpx()
    _patch_requests()
    _patch_aiohttp()


def mark_sdk_handled(host: str) -> None:
    """
    Register a host as handled by an SDK-level patcher.
    Prevents HTTP interceptor from emitting duplicate spans.
    Called by patcher.py for openai + anthropic.
    """
    _sdk_patched_hosts.add(host)


def set_sdk_active(active: bool) -> None:
    """
    Signal that an SDK-level patcher is currently executing a call.
    HTTP interceptor will skip during this window.
    """
    _local.sdk_active = active
