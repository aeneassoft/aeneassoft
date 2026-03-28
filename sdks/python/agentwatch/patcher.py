"""
[PRODUCTNAME] Python SDK — Auto-instrumentation via monkey-patching
USB-Stick Principle: 1 line init, everything works.
"""
import time
import uuid
import threading
import httpx
from functools import wraps
from typing import Optional

_proxy_url: str = "http://localhost:8080/ingest"
_api_key: str = ""
_zero_data_retention: bool = False


def init(
    api_key: str,
    proxy_url: str = "http://localhost:8080/ingest",
    zero_data_retention: bool = False,
):
    """USB-Stick Principle: 1 line init, everything works."""
    global _proxy_url, _api_key, _zero_data_retention
    _proxy_url = proxy_url
    _api_key = api_key
    _zero_data_retention = zero_data_retention
    # Share config with context module
    from agentwatch import context as _ctx
    _ctx._configure(proxy_url, api_key, zero_data_retention)
    _patch_openai()
    _patch_anthropic()


def _send_span_async(span: dict):
    """Fire-and-forget: NEVER blocks the main thread."""
    def _send():
        try:
            httpx.post(
                _proxy_url,
                json=span,
                headers={"X-[PRODUCTNAME]-API-Key": _api_key},
                timeout=0.5,
            )
        except Exception:
            pass  # Observability must NEVER crash the host app
    threading.Thread(target=_send, daemon=True).start()


def _patch_openai():
    try:
        import openai.resources.chat.completions as cc

        original_sync = cc.Completions.create
        original_async = cc.AsyncCompletions.create

        @wraps(original_sync)
        def patched_sync(self, *args, **kwargs):
            start = time.time()
            response = original_sync(self, *args, **kwargs)
            end = time.time()
            _emit_openai_span(response, kwargs, start, end)
            return response

        @wraps(original_async)
        async def patched_async(self, *args, **kwargs):
            start = time.time()
            response = await original_async(self, *args, **kwargs)
            end = time.time()
            _emit_openai_span(response, kwargs, start, end)
            return response

        cc.Completions.create = patched_sync
        cc.AsyncCompletions.create = patched_async
    except ImportError:
        pass  # openai not installed — no problem


def _patch_anthropic():
    try:
        import anthropic.resources.messages as am

        original_sync = am.Messages.create
        original_async = am.AsyncMessages.create

        @wraps(original_sync)
        def patched_sync(self, *args, **kwargs):
            start = time.time()
            response = original_sync(self, *args, **kwargs)
            end = time.time()
            _emit_anthropic_span(response, kwargs, start, end)
            return response

        @wraps(original_async)
        async def patched_async(self, *args, **kwargs):
            start = time.time()
            response = await original_async(self, *args, **kwargs)
            end = time.time()
            _emit_anthropic_span(response, kwargs, start, end)
            return response

        am.Messages.create = patched_sync
        am.AsyncMessages.create = patched_async
    except ImportError:
        pass


def _emit_openai_span(response, kwargs, start, end):
    from agentwatch.context import current_trace_id, current_span_id
    messages = kwargs.get("messages", [])
    span = {
        "trace_id": current_trace_id() or uuid.uuid4().hex,
        "span_id": uuid.uuid4().hex[:16],
        # Attach to active parent span if inside a trace() context
        **( {"parent_span_id": current_span_id()} if current_span_id() else {} ),
        "name": "openai.chat.completion",
        "kind": "CLIENT",
        "start_time_unix_nano": int(start * 1e9),
        "end_time_unix_nano": int(end * 1e9),
        "status": {"code": "OK"},
        "agent_id": "python-sdk",
        "agent_name": "[PRODUCTNAME] Python SDK",
        "agent_role": "AutoInstrumented",
        **({} if _zero_data_retention else {
            "input": str(messages[-1]) if messages else None,
            "output": response.choices[0].message.content if response.choices else None,
        }),
        "model_inference": {
            "model_name": getattr(response, "model", None),
            "provider": "OpenAI",
            "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
            "completion_tokens": response.usage.completion_tokens if response.usage else 0,
            "latency_ms": int((end - start) * 1000),
        },
    }
    _send_span_async(span)


def _emit_anthropic_span(response, kwargs, start, end):
    from agentwatch.context import current_trace_id, current_span_id
    messages = kwargs.get("messages", [])
    span = {
        "trace_id": current_trace_id() or uuid.uuid4().hex,
        "span_id": uuid.uuid4().hex[:16],
        **( {"parent_span_id": current_span_id()} if current_span_id() else {} ),
        "name": "anthropic.messages.create",
        "kind": "CLIENT",
        "start_time_unix_nano": int(start * 1e9),
        "end_time_unix_nano": int(end * 1e9),
        "status": {"code": "OK"},
        "agent_id": "python-sdk",
        "agent_name": "[PRODUCTNAME] Python SDK",
        "agent_role": "AutoInstrumented",
        **({} if _zero_data_retention else {
            "input": str(messages[-1]) if messages else None,
            "output": response.content[0].text if response.content else None,
        }),
        "model_inference": {
            "model_name": getattr(response, "model", None),
            "provider": "Anthropic",
            "prompt_tokens": response.usage.input_tokens if response.usage else 0,
            "completion_tokens": response.usage.output_tokens if response.usage else 0,
            "latency_ms": int((end - start) * 1000),
        },
    }
    _send_span_async(span)
