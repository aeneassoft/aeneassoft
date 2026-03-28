"""
[PRODUCTNAME] Python SDK — Tests for auto-instrumentation patcher
"""
import uuid
import time
import pytest
from unittest.mock import MagicMock, patch
from agentwatch.patcher import (
    init,
    _emit_openai_span,
    _emit_anthropic_span,
    _send_span_async,
)
from agentwatch.schema import ATPSpan


class TestPatcherInit:
    def test_init_sets_globals(self):
        """init() should set global config without crashing."""
        # Should not raise even without openai/anthropic installed
        init(api_key="test-key", proxy_url="http://localhost:9999/ingest")

    def test_init_with_zdr(self):
        """init() with zero_data_retention should not crash."""
        init(
            api_key="test-key",
            proxy_url="http://localhost:9999/ingest",
            zero_data_retention=True,
        )


class TestSpanEmission:
    def test_emit_openai_span_creates_valid_structure(self):
        """OpenAI span emission should create a valid span dict."""
        mock_response = MagicMock()
        mock_response.model = "gpt-4o"
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Hello!"
        mock_response.usage = MagicMock()
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 5

        spans_sent = []
        with patch(
            "agentwatch.patcher._send_span_async",
            side_effect=lambda s: spans_sent.append(s),
        ):
            _emit_openai_span(
                mock_response,
                {"messages": [{"role": "user", "content": "Hi"}]},
                time.time() - 1,
                time.time(),
            )

        assert len(spans_sent) == 1
        span = spans_sent[0]
        assert span["name"] == "openai.chat.completion"
        assert span["kind"] == "CLIENT"
        assert span["status"]["code"] == "OK"
        assert span["model_inference"]["provider"] == "OpenAI"
        assert span["model_inference"]["model_name"] == "gpt-4o"
        assert span["model_inference"]["prompt_tokens"] == 10
        assert len(span["trace_id"]) == 32
        assert len(span["span_id"]) == 16

    def test_emit_anthropic_span_creates_valid_structure(self):
        """Anthropic span emission should create a valid span dict."""
        mock_response = MagicMock()
        mock_response.model = "claude-sonnet-4-6"
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = "Hello!"
        mock_response.usage = MagicMock()
        mock_response.usage.input_tokens = 20
        mock_response.usage.output_tokens = 10

        spans_sent = []
        with patch(
            "agentwatch.patcher._send_span_async",
            side_effect=lambda s: spans_sent.append(s),
        ):
            _emit_anthropic_span(
                mock_response,
                {"messages": [{"role": "user", "content": "Hi"}]},
                time.time() - 1,
                time.time(),
            )

        assert len(spans_sent) == 1
        span = spans_sent[0]
        assert span["name"] == "anthropic.messages.create"
        assert span["model_inference"]["provider"] == "Anthropic"
        assert span["model_inference"]["prompt_tokens"] == 20

    def test_zdr_strips_input_output(self):
        """When ZDR is enabled, input/output should not be in span."""
        import agentwatch.patcher as p
        original_zdr = p._zero_data_retention
        p._zero_data_retention = True

        try:
            mock_response = MagicMock()
            mock_response.model = "gpt-4o"
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Secret output"
            mock_response.usage = MagicMock()
            mock_response.usage.prompt_tokens = 10
            mock_response.usage.completion_tokens = 5

            spans_sent = []
            with patch(
                "agentwatch.patcher._send_span_async",
                side_effect=lambda s: spans_sent.append(s),
            ):
                _emit_openai_span(
                    mock_response,
                    {"messages": [{"role": "user", "content": "Secret input"}]},
                    time.time() - 1,
                    time.time(),
                )

            span = spans_sent[0]
            assert "input" not in span
            assert "output" not in span
        finally:
            p._zero_data_retention = original_zdr


class TestSchema:
    def test_valid_span_validates(self):
        """A well-formed span should pass Pydantic validation."""
        span = ATPSpan(
            trace_id="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
            span_id="a1b2c3d4e5f6a1b2",
            name="test.span",
            kind="CLIENT",
            start_time_unix_nano=1700000000000000000,
            end_time_unix_nano=1700000001000000000,
            status={"code": "OK"},
            agent_id="test",
            agent_name="Test",
            agent_role="Test",
        )
        assert span.trace_id == "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"

    def test_invalid_trace_id_rejected(self):
        """Invalid trace_id format should be rejected."""
        with pytest.raises(Exception):
            ATPSpan(
                trace_id="invalid",
                span_id="a1b2c3d4e5f6a1b2",
                name="test.span",
                kind="CLIENT",
                start_time_unix_nano=0,
                end_time_unix_nano=0,
                status={"code": "OK"},
                agent_id="test",
                agent_name="Test",
                agent_role="Test",
            )
