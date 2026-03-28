"""
[PRODUCTNAME] Universal HTTP Interceptor
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
            "agent_name": agent_ctx.get("agent_name", "[PRODUCTNAME] Universal Interceptor"),
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


# ── httpx patch ────────────────────────────────────────────────────────────────

def _patch_httpx() -> None:
    try:
        import httpx

        _orig_sync = httpx.Client.send
        _orig_async = httpx.AsyncClient.send

        def _sync_send(self, request, **kwargs):
            url = str(request.url)
            info = _detect_provider(url)
            if not info or _is_sdk_active():
                return _orig_sync(self, request, **kwargs)
            provider, fmt = info
            req_body = getattr(request, "content", b"") or b""
            start = time.time()
            try:
                resp = _orig_sync(self, request, **kwargs)
                end = time.time()
                _emit(url, provider, fmt, req_body, getattr(resp, "content", b""),
                      resp.status_code, start, end)
                return resp
            except Exception:
                _emit(url, provider, fmt, req_body, b"", 0, start, time.time())
                raise

        async def _async_send(self, request, **kwargs):
            url = str(request.url)
            info = _detect_provider(url)
            if not info or _is_sdk_active():
                return await _orig_async(self, request, **kwargs)
            provider, fmt = info
            req_body = getattr(request, "content", b"") or b""
            start = time.time()
            try:
                resp = await _orig_async(self, request, **kwargs)
                end = time.time()
                _emit(url, provider, fmt, req_body, getattr(resp, "content", b""),
                      resp.status_code, start, end)
                return resp
            except Exception:
                _emit(url, provider, fmt, req_body, b"", 0, start, time.time())
                raise

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
            provider, fmt = info
            req_body = request.body or b""
            start = time.time()
            try:
                resp = _orig(self, request, **kwargs)
                end = time.time()
                _emit(url, provider, fmt, req_body,
                      getattr(resp, "content", b""), resp.status_code, start, end)
                return resp
            except Exception:
                _emit(url, provider, fmt, req_body, b"", 0, start, time.time())
                raise

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
