"""
AeneasSoft Python SDK — Auto-instrumentation via monkey-patching
USB-Stick Principle: 1 line init, everything works.
"""
import os
import time
import uuid
import threading
import httpx
from functools import wraps
from typing import Optional

_proxy_url: str = "http://localhost:3001/api/ingest"
_api_key: str = ""
_zero_data_retention: bool = False

_DEFAULT_LOCAL_URL = "http://localhost:3001/api/ingest"
_DEFAULT_CLOUD_URL = "https://api.aeneassoft.com/api/ingest"


def init(
    api_key: Optional[str] = None,
    proxy_url: Optional[str] = None,
    zero_data_retention: bool = False,
    # Active Defense parameters
    budget_per_hour: Optional[float] = None,
    max_error_rate: Optional[float] = None,
    max_calls_per_minute: Optional[int] = None,
    block_on_threshold: bool = False,
    on_alert=None,
    on_block=None,
):
    """
    USB-Stick Principle: 1 line init, everything works.

    Active Defense (Circuit Breaker):
        budget_per_hour: Alert (and optionally block) if cost exceeds $X/hour
        max_error_rate: Alert if error rate exceeds X (0.0-1.0)
        max_calls_per_minute: Alert if call rate exceeds X/minute (loop detection)
        block_on_threshold: If True, block calls when thresholds exceeded
        on_alert: Callback function when alert fires
        on_block: Callback (sync or async) fired BEFORE CircuitBreakerException.
                  Receives a BlockEvent with .monitor for recovery.
    """
    global _proxy_url, _api_key, _zero_data_retention
    _api_key = api_key or os.environ.get("AGENTWATCH_API_KEY", "")
    # Smart URL detection: if api_key is set → cloud, otherwise → localhost
    if proxy_url:
        _proxy_url = proxy_url
    elif _api_key and _api_key != "local":
        _proxy_url = _DEFAULT_CLOUD_URL
    else:
        _proxy_url = _DEFAULT_LOCAL_URL
    _zero_data_retention = zero_data_retention
    # Share config with context module
    from agentwatch import context as _ctx
    _ctx._configure(proxy_url, api_key, zero_data_retention)
    # Configure global Active Defense circuit breaker
    from agentwatch.circuit_breaker import get_global_monitor
    get_global_monitor().configure(
        budget=budget_per_hour,
        max_error_rate=max_error_rate,
        max_calls_per_minute=max_calls_per_minute,
        block_on_threshold=block_on_threshold,
        on_alert=on_alert,
        on_block=on_block,
    )
    _patch_openai()
    _patch_anthropic()
    # Install universal HTTP interceptor — catches every other framework
    from agentwatch.interceptor import patch_all, mark_sdk_handled
    mark_sdk_handled("api.openai.com")
    mark_sdk_handled("api.anthropic.com")
    patch_all()


def _send_span_async(span: dict):
    """Fire-and-forget: NEVER blocks the main thread."""
    def _send():
        try:
            httpx.post(
                _proxy_url,
                json=span,
                headers={"X-API-Key": _api_key},
                timeout=0.5,
            )
        except Exception:
            pass  # Observability must NEVER crash the host app
    threading.Thread(target=_send, daemon=True).start()


# ── Stream Wrappers (in-process, no network proxy) ───────────────────────────

class _OpenAIStreamWrapper:
    """In-process wrapper around OpenAI Stream. Yields chunks unchanged,
    captures usage data after stream ends. NOT a network proxy — runs
    in the same process memory as the user's code."""

    def __init__(self, stream, kwargs, start):
        self._stream = stream
        self._kwargs = kwargs
        self._start = start
        self._model = None
        self._usage = None
        self._output_parts = []

    def __iter__(self):
        for chunk in self._stream:
            if self._model is None and hasattr(chunk, "model"):
                self._model = chunk.model
            # Collect output text
            try:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and hasattr(delta, "content") and delta.content:
                    self._output_parts.append(delta.content)
            except (IndexError, AttributeError):
                pass
            # Check for usage in final chunk
            if hasattr(chunk, "usage") and chunk.usage is not None:
                self._usage = chunk.usage
            yield chunk
        self._on_end()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        if hasattr(self._stream, "__exit__"):
            self._stream.__exit__(*args)

    def __getattr__(self, name):
        return getattr(self._stream, name)

    def _on_end(self):
        try:
            from agentwatch.interceptor import _calculate_cost, _record_monitors
            end = time.time()
            pt = getattr(self._usage, "prompt_tokens", 0) or 0
            ct = getattr(self._usage, "completion_tokens", 0) or 0
            output = "".join(self._output_parts) if self._output_parts else None

            _emit_openai_stream_span(self._model, self._kwargs, pt, ct, output, self._start, end)

            cost = _calculate_cost(self._model, pt, ct)
            _record_monitors(cost, False)
        except Exception:
            pass


class _OpenAIAsyncStreamWrapper:
    """Async in-process wrapper around OpenAI AsyncStream. Same as
    _OpenAIStreamWrapper but for async iteration."""

    def __init__(self, stream, kwargs, start):
        self._stream = stream
        self._kwargs = kwargs
        self._start = start
        self._model = None
        self._usage = None
        self._output_parts = []

    async def __aiter__(self):
        async for chunk in self._stream:
            if self._model is None and hasattr(chunk, "model"):
                self._model = chunk.model
            try:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and hasattr(delta, "content") and delta.content:
                    self._output_parts.append(delta.content)
            except (IndexError, AttributeError):
                pass
            if hasattr(chunk, "usage") and chunk.usage is not None:
                self._usage = chunk.usage
            yield chunk
        self._on_end()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        if hasattr(self._stream, "__aexit__"):
            await self._stream.__aexit__(*args)

    def __getattr__(self, name):
        return getattr(self._stream, name)

    def _on_end(self):
        try:
            from agentwatch.interceptor import _calculate_cost, _record_monitors
            end = time.time()
            pt = getattr(self._usage, "prompt_tokens", 0) or 0
            ct = getattr(self._usage, "completion_tokens", 0) or 0
            output = "".join(self._output_parts) if self._output_parts else None

            _emit_openai_stream_span(self._model, self._kwargs, pt, ct, output, self._start, end)

            cost = _calculate_cost(self._model, pt, ct)
            _record_monitors(cost, False)
        except Exception:
            pass


class _AnthropicStreamWrapper:
    """In-process wrapper around Anthropic MessageStreamManager. Yields
    events unchanged, tracks usage from message_start/message_delta events."""

    def __init__(self, stream, kwargs, start):
        self._stream = stream
        self._kwargs = kwargs
        self._start = start
        self._model = None
        self._input_tokens = 0
        self._output_tokens = 0
        self._output_parts = []

    def __iter__(self):
        for event in self._stream:
            self._process_event(event)
            yield event
        self._on_end()

    def __enter__(self):
        if hasattr(self._stream, "__enter__"):
            self._stream.__enter__()
        return self

    def __exit__(self, *args):
        if hasattr(self._stream, "__exit__"):
            self._stream.__exit__(*args)

    def __getattr__(self, name):
        return getattr(self._stream, name)

    def _process_event(self, event):
        try:
            event_type = getattr(event, "type", "")
            if event_type == "message_start":
                msg = getattr(event, "message", None)
                if msg:
                    self._model = getattr(msg, "model", None)
                    usage = getattr(msg, "usage", None)
                    if usage:
                        self._input_tokens = getattr(usage, "input_tokens", 0) or 0
            elif event_type == "content_block_delta":
                delta = getattr(event, "delta", None)
                if delta and hasattr(delta, "text"):
                    self._output_parts.append(delta.text)
            elif event_type == "message_delta":
                usage = getattr(event, "usage", None)
                if usage:
                    self._output_tokens = getattr(usage, "output_tokens", 0) or 0
        except Exception:
            pass

    def _on_end(self):
        try:
            from agentwatch.interceptor import _calculate_cost, _record_monitors
            end = time.time()
            output = "".join(self._output_parts) if self._output_parts else None

            _emit_anthropic_stream_span(
                self._model, self._kwargs, self._input_tokens, self._output_tokens, output, self._start, end
            )

            cost = _calculate_cost(self._model, self._input_tokens, self._output_tokens)
            _record_monitors(cost, False)
        except Exception:
            pass


# ── SDK Patchers ─────────────────────────────────────────────────────────────

def _patch_openai():
    try:
        import openai.resources.chat.completions as cc

        original_sync = cc.Completions.create
        original_async = cc.AsyncCompletions.create

        @wraps(original_sync)
        def patched_sync(self, *args, **kwargs):
            from agentwatch.interceptor import set_sdk_active, _calculate_cost, _record_monitors
            is_stream = kwargs.get("stream", False)
            start = time.time()

            if is_stream:
                # Inject include_usage for accurate token counts
                stream_opts = kwargs.get("stream_options") or {}
                stream_opts["include_usage"] = True
                kwargs["stream_options"] = stream_opts

                set_sdk_active(True)
                try:
                    response = original_sync(self, *args, **kwargs)
                finally:
                    set_sdk_active(False)
                return _OpenAIStreamWrapper(response, kwargs, start)

            # Non-streaming (original logic)
            set_sdk_active(True)
            try:
                response = original_sync(self, *args, **kwargs)
            finally:
                set_sdk_active(False)
            end = time.time()
            _emit_openai_span(response, kwargs, start, end)
            try:
                pt = response.usage.prompt_tokens if response.usage else 0
                ct = response.usage.completion_tokens if response.usage else 0
                cost = _calculate_cost(getattr(response, "model", None), pt, ct)
                _record_monitors(cost, False)
            except Exception:
                pass
            return response

        @wraps(original_async)
        async def patched_async(self, *args, **kwargs):
            from agentwatch.interceptor import set_sdk_active, _calculate_cost, _record_monitors
            is_stream = kwargs.get("stream", False)
            start = time.time()

            if is_stream:
                stream_opts = kwargs.get("stream_options") or {}
                stream_opts["include_usage"] = True
                kwargs["stream_options"] = stream_opts

                set_sdk_active(True)
                try:
                    response = await original_async(self, *args, **kwargs)
                finally:
                    set_sdk_active(False)
                return _OpenAIAsyncStreamWrapper(response, kwargs, start)

            set_sdk_active(True)
            try:
                response = await original_async(self, *args, **kwargs)
            finally:
                set_sdk_active(False)
            end = time.time()
            _emit_openai_span(response, kwargs, start, end)
            try:
                pt = response.usage.prompt_tokens if response.usage else 0
                ct = response.usage.completion_tokens if response.usage else 0
                cost = _calculate_cost(getattr(response, "model", None), pt, ct)
                _record_monitors(cost, False)
            except Exception:
                pass
            return response

        cc.Completions.create = patched_sync
        cc.AsyncCompletions.create = patched_async
    except ImportError:
        pass


def _patch_anthropic():
    try:
        import anthropic.resources.messages as am

        original_sync = am.Messages.create
        original_async = am.AsyncMessages.create

        @wraps(original_sync)
        def patched_sync(self, *args, **kwargs):
            from agentwatch.interceptor import set_sdk_active, _calculate_cost, _record_monitors
            is_stream = kwargs.get("stream", False)
            start = time.time()

            if is_stream:
                set_sdk_active(True)
                try:
                    response = original_sync(self, *args, **kwargs)
                finally:
                    set_sdk_active(False)
                return _AnthropicStreamWrapper(response, kwargs, start)

            set_sdk_active(True)
            try:
                response = original_sync(self, *args, **kwargs)
            finally:
                set_sdk_active(False)
            end = time.time()
            _emit_anthropic_span(response, kwargs, start, end)
            try:
                pt = response.usage.input_tokens if response.usage else 0
                ct = response.usage.output_tokens if response.usage else 0
                cost = _calculate_cost(getattr(response, "model", None), pt, ct)
                _record_monitors(cost, False)
            except Exception:
                pass
            return response

        @wraps(original_async)
        async def patched_async(self, *args, **kwargs):
            from agentwatch.interceptor import set_sdk_active, _calculate_cost, _record_monitors
            is_stream = kwargs.get("stream", False)
            start = time.time()

            if is_stream:
                set_sdk_active(True)
                try:
                    response = await original_async(self, *args, **kwargs)
                finally:
                    set_sdk_active(False)
                return _AnthropicStreamWrapper(response, kwargs, start)

            set_sdk_active(True)
            try:
                response = await original_async(self, *args, **kwargs)
            finally:
                set_sdk_active(False)
            end = time.time()
            _emit_anthropic_span(response, kwargs, start, end)
            try:
                pt = response.usage.input_tokens if response.usage else 0
                ct = response.usage.output_tokens if response.usage else 0
                cost = _calculate_cost(getattr(response, "model", None), pt, ct)
                _record_monitors(cost, False)
            except Exception:
                pass
            return response

        am.Messages.create = patched_sync
        am.AsyncMessages.create = patched_async
    except ImportError:
        pass


# ── Span Emission ────────────────────────────────────────────────────────────

def _emit_openai_span(response, kwargs, start, end):
    from agentwatch.context import current_trace_id, current_span_id
    messages = kwargs.get("messages", [])
    span = {
        "trace_id": current_trace_id() or uuid.uuid4().hex,
        "span_id": uuid.uuid4().hex[:16],
        **( {"parent_span_id": current_span_id()} if current_span_id() else {} ),
        "name": "openai.chat.completion",
        "kind": "CLIENT",
        "start_time_unix_nano": int(start * 1e9),
        "end_time_unix_nano": int(end * 1e9),
        "status": {"code": "OK"},
        "agent_id": "python-sdk",
        "agent_name": "AeneasSoft Python SDK",
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


def _emit_openai_stream_span(model, kwargs, prompt_tokens, completion_tokens, output, start, end):
    """Emit span for a streaming OpenAI call (after stream ends)."""
    from agentwatch.context import current_trace_id, current_span_id
    messages = kwargs.get("messages", [])
    span = {
        "trace_id": current_trace_id() or uuid.uuid4().hex,
        "span_id": uuid.uuid4().hex[:16],
        **( {"parent_span_id": current_span_id()} if current_span_id() else {} ),
        "name": "openai.chat.completion.stream",
        "kind": "CLIENT",
        "start_time_unix_nano": int(start * 1e9),
        "end_time_unix_nano": int(end * 1e9),
        "status": {"code": "OK"},
        "agent_id": "python-sdk",
        "agent_name": "AeneasSoft Python SDK",
        "agent_role": "AutoInstrumented",
        **({} if _zero_data_retention else {
            "input": str(messages[-1]) if messages else None,
            "output": (output[:2000] if output else None),
        }),
        "model_inference": {
            "model_name": model,
            "provider": "OpenAI",
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
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
        "agent_name": "AeneasSoft Python SDK",
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


def _emit_anthropic_stream_span(model, kwargs, input_tokens, output_tokens, output, start, end):
    """Emit span for a streaming Anthropic call (after stream ends)."""
    from agentwatch.context import current_trace_id, current_span_id
    messages = kwargs.get("messages", [])
    span = {
        "trace_id": current_trace_id() or uuid.uuid4().hex,
        "span_id": uuid.uuid4().hex[:16],
        **( {"parent_span_id": current_span_id()} if current_span_id() else {} ),
        "name": "anthropic.messages.stream",
        "kind": "CLIENT",
        "start_time_unix_nano": int(start * 1e9),
        "end_time_unix_nano": int(end * 1e9),
        "status": {"code": "OK"},
        "agent_id": "python-sdk",
        "agent_name": "AeneasSoft Python SDK",
        "agent_role": "AutoInstrumented",
        **({} if _zero_data_retention else {
            "input": str(messages[-1]) if messages else None,
            "output": (output[:2000] if output else None),
        }),
        "model_inference": {
            "model_name": model,
            "provider": "Anthropic",
            "prompt_tokens": input_tokens,
            "completion_tokens": output_tokens,
            "latency_ms": int((end - start) * 1000),
        },
    }
    _send_span_async(span)
