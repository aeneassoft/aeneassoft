"""Tests for context managers integrated with Active Defense circuit breaker."""
import pytest
from unittest.mock import patch, MagicMock

from agentwatch.context import (
    agent,
    workflow,
    get_active_monitors,
    current_agent,
    trace,
)
from agentwatch.circuit_breaker import (
    ThresholdMonitor,
    CircuitBreakerException,
    get_global_monitor,
)


class TestWorkflowContextManager:
    """workflow() creates a ThresholdMonitor and manages the stack."""

    def test_workflow_pushes_and_pops_monitor(self):
        assert len(get_active_monitors()) == 0
        with workflow("test-wf", budget_per_run=5.0):
            monitors = get_active_monitors()
            assert len(monitors) == 1
            assert monitors[0].scope == "workflow"
            assert monitors[0].scope_id == "test-wf"
            assert monitors[0].budget == 5.0
        assert len(get_active_monitors()) == 0

    def test_workflow_yields_name(self):
        with workflow("my-pipeline") as name:
            assert name == "my-pipeline"


class TestAgentWithBudget:
    """agent() with budget params pushes a ThresholdMonitor."""

    def test_agent_with_budget_creates_monitor(self):
        with agent("ExpensiveBot", budget_per_hour=2.0):
            monitors = get_active_monitors()
            assert len(monitors) == 1
            assert monitors[0].scope == "agent"
            assert monitors[0].scope_id == "ExpensiveBot"
            assert monitors[0].budget == 2.0
        assert len(get_active_monitors()) == 0

    def test_agent_without_budget_no_monitor(self):
        """Backward compatibility: agent() without budget params doesn't push monitor."""
        with agent("SimpleBot", role="Worker"):
            assert len(get_active_monitors()) == 0
            ctx = current_agent()
            assert ctx["agent_name"] == "SimpleBot"
            assert ctx["agent_role"] == "Worker"

    def test_agent_with_error_rate_creates_monitor(self):
        with agent("SafeBot", max_error_rate=0.3):
            monitors = get_active_monitors()
            assert len(monitors) == 1
            assert monitors[0].max_error_rate == 0.3


class TestNestedContexts:
    """Nested workflow + agent → both monitors on stack."""

    def test_nested_workflow_agent(self):
        with workflow("outer-wf", budget_per_run=20.0):
            assert len(get_active_monitors()) == 1
            with agent("InnerBot", budget_per_hour=5.0):
                monitors = get_active_monitors()
                assert len(monitors) == 2
                assert monitors[0].scope == "workflow"
                assert monitors[1].scope == "agent"
            assert len(get_active_monitors()) == 1
        assert len(get_active_monitors()) == 0

    def test_inner_budget_triggers_first(self):
        """Inner agent budget is lower → triggers before outer workflow."""
        alerts = []
        with workflow("outer", budget_per_run=100.0, on_alert=lambda e: alerts.append(("outer", e))):
            with agent("inner", budget_per_hour=2.0, block_on_threshold=True,
                        on_alert=lambda e: alerts.append(("inner", e))):
                monitors = get_active_monitors()
                # Spend $3 on inner
                for m in monitors:
                    for _ in range(3):
                        m.record_result(cost_usd=1.0, is_error=False)

                # Inner should block (budget=2.0, spent=3.0)
                with pytest.raises(CircuitBreakerException) as exc_info:
                    for m in monitors:
                        m.check("https://api.openai.com/v1/chat")

                assert exc_info.value.scope == "agent"


class TestWorkflowBlockOnThreshold:
    """CircuitBreakerException propagates from workflow context."""

    def test_workflow_blocks_when_enabled(self):
        with workflow("block-wf", budget_per_run=1.0, block_on_threshold=True) as name:
            monitors = get_active_monitors()
            for m in monitors:
                m.record_result(cost_usd=1.50, is_error=False)

            with pytest.raises(CircuitBreakerException) as exc_info:
                for m in monitors:
                    m.check("https://api.openai.com/v1/chat")

            assert "budget" in str(exc_info.value).lower()
            assert exc_info.value.scope == "workflow"


class TestInitActiveDefense:
    """init() with Active Defense params configures global monitor."""

    def test_init_configures_global_monitor(self):
        from agentwatch.patcher import init
        with patch("agentwatch.patcher._patch_openai"), \
             patch("agentwatch.patcher._patch_anthropic"), \
             patch("agentwatch.interceptor.patch_all"), \
             patch("agentwatch.interceptor.mark_sdk_handled"):
            init(
                api_key="test",
                proxy_url="http://localhost:9999/ingest",
                budget_per_hour=10.0,
                max_error_rate=0.5,
                max_calls_per_minute=100,
                block_on_threshold=True,
            )

        gm = get_global_monitor()
        assert gm.enabled is True
        assert gm.budget == 10.0
        assert gm.max_error_rate == 0.5
        assert gm.max_calls_per_minute == 100
        assert gm.block_on_threshold is True

        # Reset global monitor for other tests
        gm.configure()


class TestAgentContextPreserved:
    """Agent identity context still works with budget params."""

    def test_agent_context_with_budget(self):
        with agent("ResearchBot", role="Researcher", budget_per_hour=5.0):
            ctx = current_agent()
            assert ctx["agent_name"] == "ResearchBot"
            assert ctx["agent_role"] == "Researcher"
            assert ctx["agent_id"] == "researchbot"
            assert len(get_active_monitors()) == 1
