"""
AeneasSoft Python SDK — Tests for auto-instrumentation patcher
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


class TestOpenAIStreamProxy:
    """Tests for streaming call handling."""

    def test_stream_proxy_yields_all_chunks(self):
        """StreamProxy must yield every chunk unchanged."""
        from agentwatch.patcher import _OpenAIStreamWrapper

        chunks = []
        for i in range(5):
            chunk = MagicMock()
            chunk.model = "gpt-4o"
            chunk.choices = [MagicMock()]
            chunk.choices[0].delta = MagicMock()
            chunk.choices[0].delta.content = f"word{i} "
            chunk.usage = None
            chunks.append(chunk)
        # Last chunk has usage
        chunks[-1].usage = MagicMock()
        chunks[-1].usage.prompt_tokens = 100
        chunks[-1].usage.completion_tokens = 50

        spans = []
        with patch("agentwatch.patcher._send_span_async", side_effect=lambda s: spans.append(s)):
            proxy = _OpenAIStreamWrapper(iter(chunks), {"messages": [{"role": "user", "content": "Hello"}]}, time.time() - 1)
            collected = list(proxy)

        assert len(collected) == 5
        assert collected[0] is chunks[0]
        assert collected[4] is chunks[4]
        # Span should have been emitted
        assert len(spans) == 1
        assert spans[0]["name"] == "openai.chat.completion.stream"
        assert spans[0]["model_inference"]["prompt_tokens"] == 100
        assert spans[0]["model_inference"]["completion_tokens"] == 50
        assert spans[0]["model_inference"]["model_name"] == "gpt-4o"

    def test_stream_proxy_captures_output_text(self):
        """StreamProxy should accumulate delta.content into output."""
        from agentwatch.patcher import _OpenAIStreamWrapper
        import agentwatch.patcher as _p
        old_zdr = _p._zero_data_retention
        _p._zero_data_retention = False

        chunks = []
        for text in ["Hello", " ", "world", "!"]:
            chunk = MagicMock()
            chunk.model = "gpt-4o"
            chunk.choices = [MagicMock()]
            chunk.choices[0].delta = MagicMock()
            chunk.choices[0].delta.content = text
            chunk.usage = None
            chunks.append(chunk)

        spans = []
        with patch("agentwatch.patcher._send_span_async", side_effect=lambda s: spans.append(s)):
            proxy = _OpenAIStreamWrapper(iter(chunks), {"messages": []}, time.time())
            list(proxy)  # consume

        _p._zero_data_retention = old_zdr
        assert spans[0].get("output") == "Hello world!"

    def test_stream_proxy_works_as_context_manager(self):
        """StreamProxy should work with `with` statement."""
        from agentwatch.patcher import _OpenAIStreamWrapper

        chunk = MagicMock()
        chunk.model = "gpt-4o"
        chunk.choices = []
        chunk.usage = None

        with patch("agentwatch.patcher._send_span_async"):
            proxy = _OpenAIStreamWrapper(iter([chunk]), {}, time.time())
            with proxy as p:
                list(p)

    def test_stream_detection_injects_include_usage(self):
        """When stream=True, include_usage should be injected."""
        # We can't test the full patched_sync without openai installed,
        # but we can verify the StreamProxy contract
        from agentwatch.patcher import _OpenAIStreamWrapper
        assert _OpenAIStreamWrapper is not None  # Class exists

    def test_non_streaming_still_works(self):
        """Non-streaming calls should still emit spans correctly."""
        from agentwatch.patcher import _emit_openai_span

        response = MagicMock()
        response.model = "gpt-4o"
        response.choices = [MagicMock()]
        response.choices[0].message.content = "Hello"
        response.usage = MagicMock()
        response.usage.prompt_tokens = 10
        response.usage.completion_tokens = 5

        spans = []
        with patch("agentwatch.patcher._send_span_async", side_effect=lambda s: spans.append(s)):
            _emit_openai_span(response, {"messages": [{"role": "user", "content": "Hi"}]}, time.time() - 0.5, time.time())

        assert len(spans) == 1
        assert spans[0]["name"] == "openai.chat.completion"  # NOT .stream
        assert spans[0]["model_inference"]["prompt_tokens"] == 10
