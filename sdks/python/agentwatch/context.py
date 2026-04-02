"""
AeneasSoft Trace Context — thread-local trace propagation.
Allows grouping multiple LLM calls into one coherent trace,
essential for LangChain chains, AutoGen conversations, CrewAI crews, etc.
"""
import uuid
import time
import threading
import httpx
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Callable, Dict, List, Optional, Generator

# Thread-local storage so concurrent traces don't interfere
_local = threading.local()

# Module-level reference to ingest config (set by patcher.init)
_ingest_url: str = "http://localhost:3001/api/ingest"
_api_key: str = ""
_zero_data_retention: bool = False


def _configure(ingest_url: str, api_key: str, zdr: bool) -> None:
    global _ingest_url, _api_key, _zero_data_retention
    _ingest_url = ingest_url
    _api_key = api_key
    _zero_data_retention = zdr


def current_trace_id() -> Optional[str]:
    """Returns the active trace_id for the current thread, or None."""
    return getattr(_local, "trace_id", None)


def current_span_id() -> Optional[str]:
    """Returns the current parent span_id for the current thread, or None."""
    return getattr(_local, "span_id", None)


def _set_context(trace_id: str, span_id: str) -> None:
    _local.trace_id = trace_id
    _local.span_id = span_id


def _clear_context() -> None:
    _local.trace_id = None
    _local.span_id = None


# ── Agent context — asyncio-safe via ContextVar ────────────────────────────────
# Carries agent_name / agent_role / agent_id through async call chains.
# Used by the HTTP interceptor to annotate auto-detected spans.
_agent_ctx: ContextVar[Dict[str, str]] = ContextVar("_agent_ctx", default={})


def current_agent() -> Dict[str, str]:
    """Returns the active agent context dict, or empty dict if none."""
    return _agent_ctx.get()


@contextmanager
def agent(
    name: str,
    role: str = "Agent",
    agent_id: Optional[str] = None,
    budget_per_hour: Optional[float] = None,
    max_error_rate: Optional[float] = None,
    block_on_threshold: bool = False,
    on_alert: Optional[Callable[[dict], Any]] = None,
    on_block: Optional[Callable] = None,
):
    """
    Context manager that tags all HTTP-intercepted AI calls with agent identity.
    Optionally attaches a ThresholdMonitor for per-agent Active Defense.

    Usage:
        with agentwatch.agent("ResearcherBot", role="Researcher"):
            result = openai.chat.completions.create(...)

        # With Active Defense:
        with agentwatch.agent("ExpensiveBot",
                              budget_per_hour=5.0,
                              block_on_threshold=True):
            result = openai.chat.completions.create(...)

    Nesting is supported — inner agent() overrides outer for its scope.
    """
    ctx = {
        "agent_name": name,
        "agent_role": role,
        "agent_id": agent_id or name.lower().replace(" ", "-"),
    }
    token = _agent_ctx.set(ctx)

    has_monitor = any([budget_per_hour, max_error_rate])
    if has_monitor:
        from agentwatch.circuit_breaker import ThresholdMonitor
        monitor = ThresholdMonitor(
            scope="agent",
            scope_id=name,
            budget=budget_per_hour,
            max_error_rate=max_error_rate,
            block_on_threshold=block_on_threshold,
            on_alert=on_alert,
            on_block=on_block,
        )
        _push_monitor(monitor)

    try:
        yield ctx
    finally:
        if has_monitor:
            _pop_monitor()
        _agent_ctx.reset(token)


def _send_span(span: dict) -> None:
    """Fire-and-forget span emission."""
    def _go():
        try:
            httpx.post(
                _ingest_url,
                json=span,
                headers={"X-AeneasSoft-API-Key": _api_key},
                timeout=0.5,
            )
        except Exception:
            pass
    threading.Thread(target=_go, daemon=True).start()


@contextmanager
def trace(
    name: str,
    agent_id: str = "user-agent",
    agent_name: str = "Agent",
    agent_role: str = "Orchestrator",
    trace_id: Optional[str] = None,
) -> Generator[str, None, None]:
    """
    Context manager that groups all LLM calls inside into one trace.

    Usage — LangChain:
        with agentwatch.trace("my-langchain-run", agent_id="chain-1") as trace_id:
            chain.invoke({"question": "What is ATP?"})

    Usage — AutoGen:
        with agentwatch.trace("autogen-conversation", agent_id="manager") as trace_id:
            groupchat.initiate_chat(...)

    Usage — CrewAI:
        with agentwatch.trace("crewai-task", agent_id="crew-1") as trace_id:
            crew.kickoff()

    Usage — Manual multi-step:
        with agentwatch.trace("my-pipeline") as trace_id:
            step1_result = openai_client.chat.completions.create(...)
            step2_result = anthropic_client.messages.create(...)
            # Both calls share the same trace_id automatically
    """
    tid = trace_id or uuid.uuid4().hex
    root_span_id = uuid.uuid4().hex[:16]
    start_ns = int(time.time() * 1e9)

    # Save previous context (supports nested traces)
    prev_trace_id = current_trace_id()
    prev_span_id = current_span_id()

    _set_context(tid, root_span_id)

    # Emit root span (start)
    root_span = {
        "trace_id": tid,
        "span_id": root_span_id,
        "name": name,
        "kind": "SERVER",
        "start_time_unix_nano": start_ns,
        "end_time_unix_nano": start_ns,  # updated on exit
        "status": {"code": "OK"},
        "agent_id": agent_id,
        "agent_name": agent_name,
        "agent_role": agent_role,
        "compliance_flags": ["eu_ai_act_art12_relevant"],
    }

    try:
        yield tid
        root_span["status"] = {"code": "OK"}
    except Exception as e:
        root_span["status"] = {"code": "ERROR", "message": str(e)}
        raise
    finally:
        end_ns = int(time.time() * 1e9)
        root_span["end_time_unix_nano"] = end_ns
        _send_span(root_span)

        # Restore previous context
        if prev_trace_id:
            _set_context(prev_trace_id, prev_span_id or "")
        else:
            _clear_context()


def span(
    name: str,
    agent_id: str = "sub-agent",
    agent_name: str = "SubAgent",
    agent_role: str = "Worker",
):
    """
    Decorator / context manager for individual agent steps within a trace.

    Usage:
        with agentwatch.trace("pipeline") as tid:
            with agentwatch.span("research-step", agent_id="researcher"):
                result = openai_client.chat.completions.create(...)
    """
    @contextmanager
    def _span_ctx():
        parent_trace_id = current_trace_id()
        parent_span_id = current_span_id()
        if not parent_trace_id:
            # No active trace — create one implicitly
            with trace(name, agent_id=agent_id, agent_name=agent_name, agent_role=agent_role):
                yield
            return

        this_span_id = uuid.uuid4().hex[:16]
        start_ns = int(time.time() * 1e9)

        # Push this span as the current parent
        _set_context(parent_trace_id, this_span_id)

        span_data = {
            "trace_id": parent_trace_id,
            "span_id": this_span_id,
            "parent_span_id": parent_span_id,
            "name": name,
            "kind": "INTERNAL",
            "start_time_unix_nano": start_ns,
            "end_time_unix_nano": start_ns,
            "status": {"code": "OK"},
            "agent_id": agent_id,
            "agent_name": agent_name,
            "agent_role": agent_role,
        }

        try:
            yield this_span_id
            span_data["status"] = {"code": "OK"}
        except Exception as e:
            span_data["status"] = {"code": "ERROR", "message": str(e)}
            raise
        finally:
            span_data["end_time_unix_nano"] = int(time.time() * 1e9)
            _send_span(span_data)
            # Restore parent context — use parent_span_id (not root_span_id which is out of scope)
            if parent_span_id:
                _set_context(parent_trace_id, parent_span_id)
            else:
                _clear_context()

    return _span_ctx()


# ── Monitor Stack — Active Defense per scope ───────────────────────────────────
_monitor_stack: ContextVar[List] = ContextVar("_monitor_stack", default=[])


def _push_monitor(monitor: Any) -> None:
    stack = _monitor_stack.get().copy()
    stack.append(monitor)
    _monitor_stack.set(stack)


def _pop_monitor() -> None:
    stack = _monitor_stack.get().copy()
    if stack:
        stack.pop()
    _monitor_stack.set(stack)


def get_active_monitors() -> List:
    """Returns all active ThresholdMonitors in the current context."""
    return _monitor_stack.get()


@contextmanager
def workflow(
    name: str,
    budget_per_run: Optional[float] = None,
    max_calls: Optional[int] = None,
    block_on_threshold: bool = False,
    on_alert: Optional[Callable[[dict], Any]] = None,
    on_block: Optional[Callable] = None,
):
    """
    Context manager for per-workflow Active Defense.

    Usage:
        with agentwatch.workflow("market-research",
                                 budget_per_run=5.0,
                                 max_calls=50):
            crew.kickoff()
    """
    from agentwatch.circuit_breaker import ThresholdMonitor
    monitor = ThresholdMonitor(
        scope="workflow",
        scope_id=name,
        budget=budget_per_run,
        max_calls_per_minute=max_calls,
        block_on_threshold=block_on_threshold,
        on_alert=on_alert,
        on_block=on_block,
    )
    _push_monitor(monitor)
    try:
        yield name
    finally:
        _pop_monitor()
