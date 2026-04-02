"""Tests for Safe Pause & Resume — State Machine, Recovery, Compliance Events."""
import asyncio
import time
import pytest
from unittest.mock import patch, MagicMock

from agentwatch.circuit_breaker import (
    ThresholdMonitor,
    CircuitBreakerException,
    BlockEvent,
    CLOSED, OPEN, PAUSED, HALF_OPEN,
)


@pytest.fixture(autouse=True)
def mock_network():
    """Prevent all threads from trying to POST to localhost."""
    with patch("agentwatch.circuit_breaker._send_span_async") as mock_span:
        with patch("agentwatch.circuit_breaker._send_alert_async"):
            yield mock_span


class TestExceptionEnrichment:
    """CircuitBreakerException carries .monitor, .trace_id, .state."""

    def test_exception_has_monitor_reference(self):
        m = ThresholdMonitor(scope="test", scope_id="enrich", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException) as exc_info:
            m.check("https://api.openai.com")

        assert exc_info.value.monitor is m
        assert exc_info.value.scope == "test"
        assert exc_info.value.scope_id == "enrich"

    def test_exception_has_state_snapshot(self):
        m = ThresholdMonitor(scope="test", scope_id="state", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException) as exc_info:
            m.check("https://api.openai.com")

        state = exc_info.value.state
        assert "circuit_state" in state
        assert state["budget"]["current_hour_cost"] == 2.0


class TestStateMachine:
    """CLOSED → OPEN → PAUSED → HALF_OPEN → CLOSED/OPEN."""

    def test_starts_closed(self):
        m = ThresholdMonitor(scope="test", scope_id="sm", budget=5.0, block_on_threshold=True)
        assert m._state == CLOSED

    def test_violation_transitions_to_open(self):
        m = ThresholdMonitor(scope="test", scope_id="sm", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        assert m._state == OPEN

    def test_open_blocks_all_calls(self):
        m = ThresholdMonitor(scope="test", scope_id="sm", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        # Subsequent calls also blocked (OPEN state)
        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

    def test_pause_transitions_to_paused(self):
        m = ThresholdMonitor(scope="test", scope_id="sm", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        m.pause(0.1)  # 100ms pause
        assert m._state == PAUSED

    def test_paused_blocks_during_timeout(self):
        m = ThresholdMonitor(scope="test", scope_id="sm", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        m.pause(10.0)  # Long pause

        with pytest.raises(CircuitBreakerException) as exc_info:
            m.check("https://api.openai.com")
        assert "paused" in exc_info.value.reason.lower()

    def test_paused_transitions_to_half_open_after_timeout(self):
        m = ThresholdMonitor(scope="test", scope_id="sm", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        m.pause(0.05)  # 50ms
        time.sleep(0.1)  # Wait past timeout

        # Should NOT raise — probe call
        m.check("https://api.openai.com")
        assert m._state == HALF_OPEN

    def test_half_open_success_transitions_to_closed(self):
        m = ThresholdMonitor(scope="test", scope_id="sm", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        m.pause(0.01)
        time.sleep(0.05)
        m.check("https://api.openai.com")  # Probe call
        assert m._state == HALF_OPEN

        m.record_result(cost_usd=0.01, is_error=False)  # Probe succeeded
        assert m._state == CLOSED

    def test_half_open_failure_retrips_to_open(self):
        m = ThresholdMonitor(scope="test", scope_id="sm", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        m.pause(0.01)
        time.sleep(0.05)
        m.check("https://api.openai.com")  # Probe call
        assert m._state == HALF_OPEN

        m.record_result(cost_usd=0.01, is_error=True)  # Probe failed
        assert m._state == OPEN


class TestRecoveryMethods:
    """pause(), increase_budget(), reset_windows()."""

    def test_increase_budget_returns_to_closed(self):
        m = ThresholdMonitor(scope="test", scope_id="rec", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        assert m._state == OPEN

        m.increase_budget(5.0)
        assert m._state == CLOSED
        assert m.budget == 6.0  # 1.0 + 5.0

        # Now the call goes through (budget is 6.0, spent 2.0)
        m.check("https://api.openai.com")

    def test_reset_windows_clears_everything(self):
        m = ThresholdMonitor(scope="test", scope_id="rec", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        m.reset_windows()
        assert m._state == CLOSED

        state = m.get_state()
        assert state["budget"]["current_hour_cost"] == 0.0
        assert state["blocked_count"] == 0

        # Call goes through
        m.check("https://api.openai.com")

    def test_recovery_via_exception_monitor_ref(self):
        """The canonical recovery pattern: catch exception, use e.monitor."""
        m = ThresholdMonitor(scope="test", scope_id="pattern", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        try:
            m.check("https://api.openai.com")
            assert False, "Should have raised"
        except CircuitBreakerException as e:
            e.monitor.increase_budget(5.0)

        # Now works
        m.check("https://api.openai.com")


class TestOnBlockCallback:
    """on_block fires before exception, supports sync and async."""

    def test_on_block_fires_before_exception(self):
        events = []
        m = ThresholdMonitor(
            scope="test", scope_id="cb",
            budget=1.0, block_on_threshold=True,
            on_block=lambda e: events.append(e),
        )
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        assert len(events) == 1
        assert isinstance(events[0], BlockEvent)
        assert events[0].reason == "Hourly budget exceeded"
        assert events[0].monitor is m

    def test_on_block_can_pause_monitor(self):
        """on_block pauses the monitor; exception still raises but monitor is now PAUSED."""
        def pause_handler(event: BlockEvent):
            event.monitor.pause(60)

        m = ThresholdMonitor(
            scope="test", scope_id="cb-pause",
            budget=1.0, block_on_threshold=True,
            on_block=pause_handler,
        )
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        # Monitor was paused by on_block (before exception propagated)
        assert m._state == PAUSED

    def test_on_block_async_callback(self):
        events = []

        async def async_handler(event: BlockEvent):
            events.append(event)

        m = ThresholdMonitor(
            scope="test", scope_id="async",
            budget=1.0, block_on_threshold=True,
            on_block=async_handler,
        )
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        # Async callback was invoked
        assert len(events) == 1

    def test_on_block_exception_swallowed(self):
        """Bad on_block doesn't crash the host app."""
        def bad_handler(event):
            raise RuntimeError("handler crashed")

        m = ThresholdMonitor(
            scope="test", scope_id="crash",
            budget=1.0, block_on_threshold=True,
            on_block=bad_handler,
        )
        m.record_result(cost_usd=2.0, is_error=False)

        # Should raise CircuitBreakerException, not RuntimeError
        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")


class TestComplianceEvents:
    """Every state transition emits an EU AI Act compliance span."""

    def test_triggered_emits_event(self, mock_network):
        m = ThresholdMonitor(scope="test", scope_id="compliance", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)
        mock_network.reset_mock()

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        assert mock_network.called
        span = mock_network.call_args[0][0]
        assert span["name"] == "circuit_breaker.circuit_breaker_triggered"
        assert "eu_ai_act_art12_relevant" in span["compliance_flags"]

    def test_pause_emits_event(self, mock_network):
        m = ThresholdMonitor(scope="test", scope_id="compliance", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        mock_network.reset_mock()
        m.pause(60)

        assert mock_network.called
        span = mock_network.call_args[0][0]
        assert span["name"] == "circuit_breaker.circuit_breaker_paused"
        assert span["attributes"]["pause_seconds"] == 60

    def test_increase_budget_emits_event(self, mock_network):
        m = ThresholdMonitor(scope="test", scope_id="compliance", budget=1.0, block_on_threshold=True)
        mock_network.reset_mock()

        m.increase_budget(5.0)

        assert mock_network.called
        span = mock_network.call_args[0][0]
        assert span["name"] == "circuit_breaker.budget_increased"
        assert span["attributes"]["additional_usd"] == 5.0
        assert span["attributes"]["new_budget"] == 6.0

    def test_reset_emits_event(self, mock_network):
        m = ThresholdMonitor(scope="test", scope_id="compliance", budget=1.0)
        mock_network.reset_mock()

        m.reset_windows()

        assert mock_network.called
        span = mock_network.call_args[0][0]
        assert span["name"] == "circuit_breaker.circuit_breaker_reset"
        assert "eu_ai_act_art12_relevant" in span["compliance_flags"]

    def test_half_open_recovery_emits_event(self, mock_network):
        m = ThresholdMonitor(scope="test", scope_id="compliance", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        m.pause(0.01)
        time.sleep(0.05)
        m.check("https://api.openai.com")  # Probe
        mock_network.reset_mock()

        m.record_result(cost_usd=0.01, is_error=False)  # Success

        assert mock_network.called
        span = mock_network.call_args[0][0]
        assert span["name"] == "circuit_breaker.circuit_breaker_recovered"

    def test_half_open_retrip_emits_event(self, mock_network):
        m = ThresholdMonitor(scope="test", scope_id="compliance", budget=1.0, block_on_threshold=True)
        m.record_result(cost_usd=2.0, is_error=False)

        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com")

        m.pause(0.01)
        time.sleep(0.05)
        m.check("https://api.openai.com")  # Probe
        mock_network.reset_mock()

        m.record_result(cost_usd=0.01, is_error=True)  # Failure

        assert mock_network.called
        span = mock_network.call_args[0][0]
        assert span["name"] == "circuit_breaker.circuit_breaker_retrip"
