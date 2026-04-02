"""
AeneasSoft Active Defense — Circuit Breaker with Safe Pause & Resume

State Machine:
  CLOSED → threshold exceeded → OPEN → pause(N) → PAUSED → timeout → HALF_OPEN
  HALF_OPEN → probe OK → CLOSED | probe fails → OPEN (re-trip)

Recovery methods live on the ThresholdMonitor (not the exception).
The exception carries a .monitor reference for recovery.

Alert-first design:
- Alerts ALWAYS fire when thresholds are exceeded
- Blocking is opt-in via block_on_threshold=True
- Every state transition emits an EU AI Act compliance event
"""
import asyncio
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass
from typing import Optional, Callable, Any

# ── States ────────────────────────────────────────────────────────────────────
CLOSED = "CLOSED"
OPEN = "OPEN"
PAUSED = "PAUSED"
HALF_OPEN = "HALF_OPEN"


class AlertViolation:
    """Represents a threshold violation."""
    __slots__ = ("reason", "threshold", "current")

    def __init__(self, reason: str, threshold: float, current: float):
        self.reason = reason
        self.threshold = threshold
        self.current = current


class CircuitBreakerException(Exception):
    """Raised when block_on_threshold=True and a threshold is exceeded.

    The exception carries a reference to the monitor that triggered it,
    enabling recovery without losing control flow:

        except CircuitBreakerException as e:
            e.monitor.pause(60)           # Half-Open after 60s
            e.monitor.increase_budget(5)  # Or: raise budget immediately
    """

    def __init__(
        self,
        reason: str,
        threshold: float,
        current: float,
        scope: str = "global",
        scope_id: str = "",
        monitor: Optional["ThresholdMonitor"] = None,
        trace_id: Optional[str] = None,
        state: Optional[dict] = None,
    ):
        self.reason = reason
        self.threshold = threshold
        self.current = current
        self.scope = scope
        self.scope_id = scope_id
        self.monitor = monitor
        self.trace_id = trace_id
        self.state = state or {}
        super().__init__(
            f"AeneasSoft blocked [{scope}:{scope_id}]: {reason} "
            f"(threshold: {threshold}, current: {current:.2f})"
        )


@dataclass
class BlockEvent:
    """Passed to on_block callback before the exception is raised.
    Contains the monitor reference for recovery decisions.
    """
    reason: str
    threshold: float
    current: float
    scope: str
    scope_id: str
    trace_id: Optional[str]
    state: dict
    monitor: "ThresholdMonitor"


def _send_alert_async(alert_data: dict) -> None:
    """Fire-and-forget alert to backend."""
    def _go():
        try:
            import httpx
            from agentwatch.patcher import _proxy_url, _api_key
            base = _proxy_url.rsplit("/ingest", 1)[0] if _proxy_url.endswith("/ingest") else _proxy_url
            httpx.post(
                f"{base}/api/alerts/sdk-alert",
                json=alert_data,
                headers={"X-API-Key": _api_key},
                timeout=1.0,
            )
        except Exception:
            pass
    threading.Thread(target=_go, daemon=True).start()


def _send_span_async(span: dict) -> None:
    """Fire-and-forget span emission for compliance events."""
    def _go():
        try:
            import httpx
            from agentwatch.patcher import _proxy_url, _api_key
            httpx.post(
                _proxy_url,
                json=span,
                headers={"X-AeneasSoft-API-Key": _api_key},
                timeout=0.5,
            )
        except Exception:
            pass
    threading.Thread(target=_go, daemon=True).start()


class ThresholdMonitor:
    """
    Monitors thresholds with a full state machine (CLOSED/OPEN/PAUSED/HALF_OPEN).

    Recovery methods:
        .pause(seconds)         — Transition to PAUSED, probe after timeout
        .increase_budget(usd)   — Raise budget and return to CLOSED
        .reset_windows()        — Emergency reset, clear all windows

    Thread-safe via threading.Lock on all operations.
    """

    def __init__(
        self,
        scope: str = "global",
        scope_id: str = "",
        budget: Optional[float] = None,
        max_error_rate: Optional[float] = None,
        max_calls_per_minute: Optional[int] = None,
        block_on_threshold: bool = False,
        on_alert: Optional[Callable[[dict], Any]] = None,
        on_block: Optional[Callable[["BlockEvent"], Any]] = None,
    ):
        self.scope = scope
        self.scope_id = scope_id
        self.budget = budget
        self.max_error_rate = max_error_rate
        self.max_calls_per_minute = max_calls_per_minute
        self.block_on_threshold = block_on_threshold
        self.on_alert = on_alert
        self.on_block = on_block
        self.enabled = any([
            budget is not None,
            max_error_rate is not None,
            max_calls_per_minute is not None,
        ])
        self._lock = threading.RLock()
        self._cost_window: deque = deque(maxlen=10_000)
        self._error_window: deque = deque(maxlen=10_000)
        self._call_window: deque = deque(maxlen=10_000)
        self._last_alert_times: dict = {}
        self._blocked_count: int = 0
        self._alert_cooldown: float = 60.0
        # State machine
        self._state: str = CLOSED
        self._paused_until: Optional[float] = None

    def configure(
        self,
        budget: Optional[float] = None,
        max_error_rate: Optional[float] = None,
        max_calls_per_minute: Optional[int] = None,
        block_on_threshold: bool = False,
        on_alert: Optional[Callable[[dict], Any]] = None,
        on_block: Optional[Callable[["BlockEvent"], Any]] = None,
    ) -> None:
        self.budget = budget
        self.max_error_rate = max_error_rate
        self.max_calls_per_minute = max_calls_per_minute
        self.block_on_threshold = block_on_threshold
        self.on_alert = on_alert
        self.on_block = on_block
        self.enabled = any([
            budget is not None,
            max_error_rate is not None,
            max_calls_per_minute is not None,
        ])
        self._state = CLOSED

    # ── Recovery Methods ──────────────────────────────────────────────────────

    def pause(self, seconds: float) -> None:
        """Transition to PAUSED. Next call after timeout is a probe (HALF_OPEN).
        Safe to call from on_block (RLock allows re-entrant acquisition)."""
        with self._lock:
            self._state = PAUSED
            self._paused_until = time.time() + seconds
        self._emit_compliance_event("circuit_breaker_paused", {
            "pause_seconds": seconds,
        })

    def increase_budget(self, additional_usd: float) -> None:
        """Raise budget threshold and return to CLOSED.
        Safe to call from on_block (RLock allows re-entrant acquisition)."""
        with self._lock:
            if self.budget is not None:
                self.budget += additional_usd
            self._state = CLOSED
        self._emit_compliance_event("budget_increased", {
            "additional_usd": additional_usd,
            "new_budget": self.budget,
        })

    def reset_windows(self) -> None:
        """Emergency reset — clears all sliding windows and returns to CLOSED.
        Safe to call from on_block (RLock allows re-entrant acquisition)."""
        with self._lock:
            self._cost_window.clear()
            self._error_window.clear()
            self._call_window.clear()
            self._blocked_count = 0
            self._state = CLOSED
        self._emit_compliance_event("circuit_breaker_reset", {})

    # ── Core Check ────────────────────────────────────────────────────────────

    def _clean_window(self, window: deque, max_age_seconds: int) -> None:
        now = time.time()
        while window and (now - window[0][0]) > max_age_seconds:
            window.popleft()

    def check(self, url: str) -> None:
        """Check thresholds BEFORE the call. Respects state machine."""
        if not self.enabled:
            return

        with self._lock:
            now = time.time()

            # ── State machine ────────────────────────────────────────────
            if self._state == PAUSED:
                if self._paused_until and now >= self._paused_until:
                    self._state = HALF_OPEN  # Allow probe call
                    return
                # Still paused — block
                from agentwatch.context import current_trace_id
                raise CircuitBreakerException(
                    reason="Circuit breaker paused (waiting for probe window)",
                    threshold=0, current=0,
                    scope=self.scope, scope_id=self.scope_id,
                    monitor=self, trace_id=current_trace_id(),
                    state=self._get_state_unlocked(),
                )

            if self._state == HALF_OPEN:
                return  # Probe call — let through

            if self._state == OPEN:
                # OPEN without pause = hard block (legacy kill-switch behavior)
                from agentwatch.context import current_trace_id
                raise CircuitBreakerException(
                    reason="Circuit breaker open",
                    threshold=0, current=0,
                    scope=self.scope, scope_id=self.scope_id,
                    monitor=self, trace_id=current_trace_id(),
                    state=self._get_state_unlocked(),
                )

            # ── CLOSED: normal threshold checks ──────────────────────────

            # 1. BUDGET CHECK (sliding 1-hour window)
            if self.budget is not None:
                self._clean_window(self._cost_window, 3600)
                total_cost = sum(c for _, c in self._cost_window)
                if total_cost >= self.budget:
                    self._handle_violation(AlertViolation(
                        reason="Hourly budget exceeded",
                        threshold=self.budget,
                        current=total_cost,
                    ))

            # 2. ERROR RATE CHECK (sliding 5-minute window, min 10 calls)
            if self.max_error_rate is not None:
                self._clean_window(self._error_window, 300)
                if len(self._error_window) >= 10:
                    errors = sum(1 for _, e in self._error_window if e)
                    rate = errors / len(self._error_window)
                    if rate >= self.max_error_rate:
                        self._handle_violation(AlertViolation(
                            reason="Error rate too high",
                            threshold=self.max_error_rate,
                            current=rate,
                        ))

            # 3. LOOP DETECTION (sliding 1-minute window)
            if self.max_calls_per_minute is not None:
                self._clean_window(self._call_window, 60)
                call_count = len(self._call_window)
                if call_count >= self.max_calls_per_minute:
                    self._handle_violation(AlertViolation(
                        reason="Too many calls (loop detected)",
                        threshold=float(self.max_calls_per_minute),
                        current=float(call_count),
                    ))

            # Record call attempt
            self._call_window.append((now, url))

    def record_result(self, cost_usd: float, is_error: bool) -> None:
        """Record result after a call completes. Handles HALF_OPEN transition."""
        if not self.enabled:
            return
        with self._lock:
            now = time.time()
            self._cost_window.append((now, cost_usd))
            self._error_window.append((now, is_error))

            # Half-Open probe result
            if self._state == HALF_OPEN:
                if is_error:
                    self._state = OPEN
                    self._emit_compliance_event_unlocked("circuit_breaker_retrip", {
                        "probe_cost": cost_usd,
                    })
                else:
                    self._state = CLOSED
                    self._emit_compliance_event_unlocked("circuit_breaker_recovered", {
                        "probe_cost": cost_usd,
                    })

    # ── Violation Handling ────────────────────────────────────────────────────

    def _handle_violation(self, violation: AlertViolation) -> None:
        """Fire alert (with cooldown), call on_block, optionally block."""
        now = time.time()

        # Compliance event
        self._emit_compliance_event_unlocked("circuit_breaker_triggered", {
            "reason": violation.reason,
            "threshold": violation.threshold,
            "current": violation.current,
        })

        # Alert cooldown
        last_time = self._last_alert_times.get(violation.reason, 0)
        should_alert = (now - last_time) >= self._alert_cooldown

        if should_alert:
            self._last_alert_times[violation.reason] = now
            alert_data = {
                "scope": self.scope,
                "scope_id": self.scope_id,
                "reason": violation.reason,
                "threshold": violation.threshold,
                "current": violation.current,
                "blocked": self.block_on_threshold,
                "timestamp": now,
            }
            _send_alert_async(alert_data)
            if self.on_alert:
                try:
                    self.on_alert(alert_data)
                except Exception:
                    pass

        if self.block_on_threshold:
            self._blocked_count += 1
            self._state = OPEN

            # on_block callback (sync + async) — fires BEFORE raise
            from agentwatch.context import current_trace_id
            if self.on_block:
                event = BlockEvent(
                    reason=violation.reason,
                    threshold=violation.threshold,
                    current=violation.current,
                    scope=self.scope,
                    scope_id=self.scope_id,
                    trace_id=current_trace_id(),
                    state=self._get_state_unlocked(),
                    monitor=self,
                )
                try:
                    result = self.on_block(event)
                    if asyncio.iscoroutine(result):
                        try:
                            loop = asyncio.get_running_loop()
                            loop.create_task(result)
                        except RuntimeError:
                            asyncio.run(result)
                except Exception:
                    pass  # Never crash the host app

            raise CircuitBreakerException(
                reason=violation.reason,
                threshold=violation.threshold,
                current=violation.current,
                scope=self.scope,
                scope_id=self.scope_id,
                monitor=self,
                trace_id=current_trace_id(),
                state=self._get_state_unlocked(),
            )

    # ── State Inspection ──────────────────────────────────────────────────────

    def get_state(self) -> dict:
        """Return current monitor state (thread-safe)."""
        with self._lock:
            return self._get_state_unlocked()

    def _get_state_unlocked(self) -> dict:
        """Internal state snapshot (caller must hold lock)."""
        now = time.time()
        self._clean_window(self._cost_window, 3600)
        hour_cost = sum(c for _, c in self._cost_window)
        self._clean_window(self._error_window, 300)
        total_calls = len(self._error_window)
        error_count = sum(1 for _, e in self._error_window if e)
        error_rate = error_count / total_calls if total_calls >= 10 else 0.0
        self._clean_window(self._call_window, 60)
        calls_per_min = len(self._call_window)

        return {
            "circuit_state": self._state,
            "scope": self.scope,
            "scope_id": self.scope_id,
            "enabled": self.enabled,
            "block_on_threshold": self.block_on_threshold,
            "budget": {
                "current_hour_cost": round(hour_cost, 4),
                "limit": self.budget,
                "remaining": round(self.budget - hour_cost, 4) if self.budget else None,
            },
            "error_rate": {
                "current_rate": round(error_rate, 4),
                "window_calls": total_calls,
                "limit": self.max_error_rate,
            },
            "call_rate": {
                "current_minute": calls_per_min,
                "limit": self.max_calls_per_minute,
            },
            "blocked_count": self._blocked_count,
            "last_alert": max(self._last_alert_times.values()) if self._last_alert_times else None,
        }

    # ── EU AI Act Compliance Events ───────────────────────────────────────────

    def _emit_compliance_event(self, event_type: str, details: dict) -> None:
        """Emits a compliance-relevant span. Thread-safe wrapper."""
        self._emit_compliance_event_unlocked(event_type, details)

    def _emit_compliance_event_unlocked(self, event_type: str, details: dict) -> None:
        """Emits a compliance span (caller may or may not hold lock)."""
        from agentwatch.context import current_trace_id
        span = {
            "trace_id": current_trace_id() or uuid.uuid4().hex,
            "span_id": uuid.uuid4().hex[:16],
            "name": f"circuit_breaker.{event_type}",
            "kind": "INTERNAL",
            "start_time_unix_nano": int(time.time() * 1e9),
            "end_time_unix_nano": int(time.time() * 1e9),
            "status": {"code": "OK"},
            "agent_id": self.scope_id or "global",
            "agent_name": "AeneasSoft CircuitBreaker",
            "agent_role": "SafetyMonitor",
            "compliance_flags": ["eu_ai_act_art12_relevant"],
            "attributes": {
                "cb.event": event_type,
                "cb.scope": self.scope,
                "cb.scope_id": self.scope_id,
                "cb.state": self._state,
                **details,
            },
        }
        _send_span_async(span)


# Global singleton
_global_monitor = ThresholdMonitor(scope="global", scope_id="default")


def get_global_monitor() -> ThresholdMonitor:
    return _global_monitor
