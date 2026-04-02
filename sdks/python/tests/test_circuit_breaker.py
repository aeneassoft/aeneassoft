"""Tests for Active Defense Circuit Breaker."""
import threading
import time
import pytest
from unittest.mock import patch, MagicMock

from agentwatch.circuit_breaker import (
    ThresholdMonitor,
    CircuitBreakerException,
    AlertViolation,
    get_global_monitor,
)


class TestAlertWithoutBlock:
    """Alert fires but no CircuitBreakerException when block_on_threshold=False."""

    def test_budget_alert_no_block(self):
        alerts = []
        m = ThresholdMonitor(
            scope="test", scope_id="budget-alert",
            budget=10.0,
            block_on_threshold=False,
            on_alert=lambda e: alerts.append(e),
        )
        # Simulate 7 calls at $1.50 each = $10.50 total
        for _ in range(7):
            m.record_result(cost_usd=1.50, is_error=False)

        # 8th call should fire alert but NOT raise
        m.check("https://api.openai.com/v1/chat/completions")
        assert len(alerts) == 1
        assert alerts[0]["reason"] == "Hourly budget exceeded"
        assert alerts[0]["blocked"] is False

    def test_error_rate_alert_no_block(self):
        alerts = []
        m = ThresholdMonitor(
            scope="test", scope_id="error-alert",
            max_error_rate=0.5,
            block_on_threshold=False,
            on_alert=lambda e: alerts.append(e),
        )
        # 8 errors out of 10 = 80% error rate
        for i in range(10):
            m.record_result(cost_usd=0.0, is_error=(i < 8))

        m.check("https://api.openai.com/v1/chat/completions")
        assert len(alerts) == 1
        assert "Error rate" in alerts[0]["reason"]


class TestAlertWithBlock:
    """CircuitBreakerException raised when block_on_threshold=True."""

    def test_budget_block(self):
        m = ThresholdMonitor(
            scope="test", scope_id="budget-block",
            budget=10.0,
            block_on_threshold=True,
        )
        for _ in range(7):
            m.record_result(cost_usd=1.50, is_error=False)

        with pytest.raises(CircuitBreakerException) as exc_info:
            m.check("https://api.openai.com/v1/chat/completions")
        assert "budget exceeded" in str(exc_info.value).lower()
        assert exc_info.value.scope == "test"
        assert exc_info.value.scope_id == "budget-block"

    def test_loop_detection_block(self):
        m = ThresholdMonitor(
            scope="test", scope_id="loop-block",
            max_calls_per_minute=100,
            block_on_threshold=True,
        )
        # 100 calls fill the window
        for _ in range(100):
            m.check("https://api.openai.com/v1/chat/completions")

        # 101st call should block
        with pytest.raises(CircuitBreakerException) as exc_info:
            m.check("https://api.openai.com/v1/chat/completions")
        assert "loop" in str(exc_info.value).lower()


class TestPerAgentScope:
    """Agent A has limit, Agent B doesn't — only A triggers."""

    def test_scoped_isolation(self):
        alerts_a = []
        alerts_b = []
        agent_a = ThresholdMonitor(
            scope="agent", scope_id="AgentA",
            budget=5.0,
            block_on_threshold=True,
            on_alert=lambda e: alerts_a.append(e),
        )
        agent_b = ThresholdMonitor(
            scope="agent", scope_id="AgentB",
            # No budget set — no limits
        )

        # Spend $6 on Agent A
        for _ in range(4):
            agent_a.record_result(cost_usd=1.50, is_error=False)

        # Agent A should block
        with pytest.raises(CircuitBreakerException):
            agent_a.check("https://api.openai.com/v1/chat/completions")

        # Agent B should NOT block (no limits configured)
        agent_b.check("https://api.openai.com/v1/chat/completions")
        assert len(alerts_b) == 0


class TestMonitorStack:
    """Nested contexts — both monitors checked."""

    def test_nested_monitors(self):
        alerts = []
        outer = ThresholdMonitor(
            scope="workflow", scope_id="outer",
            budget=20.0,
            block_on_threshold=False,
            on_alert=lambda e: alerts.append(("outer", e)),
        )
        inner = ThresholdMonitor(
            scope="agent", scope_id="inner",
            budget=5.0,
            block_on_threshold=True,
            on_alert=lambda e: alerts.append(("inner", e)),
        )

        # Spend $6 — inner (5.0) should trigger, outer (20.0) should not
        for _ in range(4):
            outer.record_result(cost_usd=1.50, is_error=False)
            inner.record_result(cost_usd=1.50, is_error=False)

        # Outer passes
        outer.check("https://api.openai.com/v1/chat/completions")

        # Inner blocks
        with pytest.raises(CircuitBreakerException):
            inner.check("https://api.openai.com/v1/chat/completions")


class TestOnAlertCallback:
    """Callback called correctly, exception in callback doesn't crash."""

    def test_callback_fires(self):
        events = []
        m = ThresholdMonitor(
            scope="test", scope_id="cb-test",
            max_calls_per_minute=5,
            block_on_threshold=False,
            on_alert=lambda e: events.append(e),
        )
        for _ in range(5):
            m.check("https://api.openai.com/v1/chat/completions")

        m.check("https://api.openai.com/v1/chat/completions")
        assert len(events) == 1
        assert events[0]["scope"] == "test"
        assert events[0]["scope_id"] == "cb-test"

    def test_callback_exception_swallowed(self):
        def bad_callback(e):
            raise RuntimeError("callback crashed")

        m = ThresholdMonitor(
            scope="test", scope_id="crash-test",
            max_calls_per_minute=5,
            block_on_threshold=False,
            on_alert=bad_callback,
        )
        for _ in range(5):
            m.check("https://api.openai.com/v1/chat/completions")

        # Should NOT raise despite bad callback
        m.check("https://api.openai.com/v1/chat/completions")


class TestThreadSafety:
    """10 parallel threads — no race conditions."""

    def test_concurrent_access(self):
        m = ThresholdMonitor(
            scope="test", scope_id="thread-test",
            budget=1000.0,
            max_calls_per_minute=10000,
            block_on_threshold=False,
        )
        errors = []

        def worker():
            try:
                for _ in range(100):
                    m.check("https://api.openai.com/v1/chat/completions")
                    m.record_result(cost_usd=0.01, is_error=False)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0


class TestCostCalculation:
    """Cost calculation from model + tokens."""

    def test_gpt4o_cost(self):
        from agentwatch.interceptor import _calculate_cost
        # GPT-4o: $5/1M prompt, $15/1M completion
        cost = _calculate_cost("gpt-4o", 1000, 500)
        expected = (1000 * 5.0 + 500 * 15.0) / 1_000_000  # = 0.0125
        assert abs(cost - expected) < 0.0001

    def test_gpt4o_mini_cost(self):
        from agentwatch.interceptor import _calculate_cost
        cost = _calculate_cost("gpt-4o-mini", 1000, 500)
        expected = (1000 * 0.15 + 500 * 0.6) / 1_000_000
        assert abs(cost - expected) < 0.0001

    def test_claude_cost(self):
        from agentwatch.interceptor import _calculate_cost
        cost = _calculate_cost("claude-sonnet-4-6", 1000, 500)
        expected = (1000 * 3.0 + 500 * 15.0) / 1_000_000
        assert abs(cost - expected) < 0.0001

    def test_unknown_model_uses_default(self):
        from agentwatch.interceptor import _calculate_cost
        cost = _calculate_cost("some-unknown-model-v3", 1000, 500)
        assert cost > 0  # Should use default price, not 0

    def test_none_model_uses_default(self):
        from agentwatch.interceptor import _calculate_cost
        cost = _calculate_cost(None, 1000, 500)
        assert cost > 0

    def test_prefix_match(self):
        from agentwatch.interceptor import _calculate_cost
        # "gpt-4o-2024-08-06" should match "gpt-4o" prefix
        cost = _calculate_cost("gpt-4o-2024-08-06", 1000, 500)
        expected = (1000 * 5.0 + 500 * 15.0) / 1_000_000
        assert abs(cost - expected) < 0.0001


class TestAlertCooldown:
    """Alert cooldown prevents spam."""

    def test_second_alert_within_cooldown_suppressed(self):
        alerts = []
        m = ThresholdMonitor(
            scope="test", scope_id="cooldown-test",
            budget=1.0,
            block_on_threshold=False,
            on_alert=lambda e: alerts.append(e),
        )
        # Exceed budget
        for _ in range(3):
            m.record_result(cost_usd=0.50, is_error=False)

        # First check → alert fires
        m.check("https://api.openai.com/v1/chat")
        assert len(alerts) == 1

        # Second check immediately → alert suppressed (cooldown)
        m.check("https://api.openai.com/v1/chat")
        assert len(alerts) == 1  # Still 1, not 2

    def test_blocking_still_works_during_cooldown(self):
        m = ThresholdMonitor(
            scope="test", scope_id="cooldown-block",
            budget=1.0,
            block_on_threshold=True,
        )
        for _ in range(3):
            m.record_result(cost_usd=0.50, is_error=False)

        # First: blocks + alerts
        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com/v1/chat")

        # Second: still blocks (even if alert is suppressed)
        with pytest.raises(CircuitBreakerException):
            m.check("https://api.openai.com/v1/chat")


class TestGetState:
    """Monitor state inspection."""

    def test_get_state_returns_current_values(self):
        m = ThresholdMonitor(
            scope="test", scope_id="state-test",
            budget=10.0,
            max_error_rate=0.5,
            max_calls_per_minute=100,
        )
        m.record_result(cost_usd=1.50, is_error=False)
        m.record_result(cost_usd=2.00, is_error=True)

        state = m.get_state()
        assert state["scope"] == "test"
        assert state["budget"]["current_hour_cost"] == 3.5
        assert state["budget"]["limit"] == 10.0
        assert state["budget"]["remaining"] == 6.5
        assert state["error_rate"]["window_calls"] == 2
        assert state["blocked_count"] == 0


class TestDisabledByDefault:
    """Without parameters, no blocking or alerting."""

    def test_no_config_no_block(self):
        m = ThresholdMonitor()
        assert m.enabled is False
        # Should never raise
        for _ in range(1000):
            m.check("https://api.openai.com/v1/chat/completions")
            m.record_result(cost_usd=100.0, is_error=True)
