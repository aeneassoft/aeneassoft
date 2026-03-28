"""
[PRODUCTNAME] Python SDK — Tests for universal HTTP interceptor
"""
import json
import time
import pytest
from unittest.mock import MagicMock, patch, AsyncMock


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_openai_response() -> dict:
    return {
        "choices": [{"message": {"content": "Hello!"}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        "model": "gpt-4o",
    }


def _make_anthropic_response() -> dict:
    return {
        "content": [{"text": "Hello!"}],
        "usage": {"input_tokens": 20, "output_tokens": 10},
        "model": "claude-sonnet-4-6",
    }


def _make_request_body(model: str = "gpt-4o") -> bytes:
    return json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": "What is ATP?"}],
    }).encode()


# ── Provider detection ────────────────────────────────────────────────────────

class TestDetectProvider:
    def test_openai_detected(self):
        from agentwatch.interceptor import _detect_provider
        result = _detect_provider("https://api.openai.com/v1/chat/completions")
        assert result == ("OpenAI", "openai")

    def test_anthropic_detected(self):
        from agentwatch.interceptor import _detect_provider
        result = _detect_provider("https://api.anthropic.com/v1/messages")
        assert result == ("Anthropic", "anthropic")

    def test_groq_detected(self):
        from agentwatch.interceptor import _detect_provider
        result = _detect_provider("https://api.groq.com/openai/v1/chat/completions")
        assert result == ("Groq", "openai_compat")

    def test_gemini_detected(self):
        from agentwatch.interceptor import _detect_provider
        result = _detect_provider("https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent")
        assert result == ("Gemini", "gemini")

    def test_azure_detected(self):
        from agentwatch.interceptor import _detect_provider
        result = _detect_provider("https://mydeployment.openai.azure.com/openai/deployments/gpt-4/chat/completions")
        assert result == ("Azure OpenAI", "openai_compat")

    def test_unknown_host_returns_none(self):
        from agentwatch.interceptor import _detect_provider
        result = _detect_provider("https://example.com/api/v1")
        assert result is None

    def test_ollama_localhost_detected(self):
        from agentwatch.interceptor import _detect_provider
        result = _detect_provider("http://localhost:11434/api/chat")
        assert result == ("Ollama", "openai_compat")


# ── Body parsing ──────────────────────────────────────────────────────────────

class TestBodyParsing:
    def test_extract_model_from_bytes(self):
        from agentwatch.interceptor import _extract_model
        body = json.dumps({"model": "gpt-4o", "messages": []}).encode()
        assert _extract_model(body) == "gpt-4o"

    def test_extract_model_from_dict(self):
        from agentwatch.interceptor import _extract_model
        assert _extract_model({"model": "claude-3-opus", "messages": []}) == "claude-3-opus"

    def test_extract_input_last_message(self):
        from agentwatch.interceptor import _extract_input
        body = json.dumps({
            "messages": [
                {"role": "system", "content": "You are helpful."},
                {"role": "user", "content": "What is 2+2?"},
            ]
        }).encode()
        result = _extract_input(body)
        assert result == "What is 2+2?"

    def test_extract_input_truncates_at_2000(self):
        from agentwatch.interceptor import _extract_input
        long_content = "x" * 3000
        body = json.dumps({"messages": [{"role": "user", "content": long_content}]}).encode()
        result = _extract_input(body)
        assert result is not None
        assert len(result) == 2000

    def test_extract_tokens_openai(self):
        from agentwatch.interceptor import _extract_tokens
        body = json.dumps(_make_openai_response()).encode()
        prompt, completion = _extract_tokens(body, "openai")
        assert prompt == 10
        assert completion == 5

    def test_extract_tokens_anthropic(self):
        from agentwatch.interceptor import _extract_tokens
        body = json.dumps(_make_anthropic_response()).encode()
        prompt, completion = _extract_tokens(body, "anthropic")
        assert prompt == 20
        assert completion == 10

    def test_extract_output_openai(self):
        from agentwatch.interceptor import _extract_output
        body = json.dumps(_make_openai_response()).encode()
        assert _extract_output(body, "openai") == "Hello!"

    def test_extract_output_anthropic(self):
        from agentwatch.interceptor import _extract_output
        body = json.dumps(_make_anthropic_response()).encode()
        assert _extract_output(body, "anthropic") == "Hello!"

    def test_parse_invalid_json_returns_none(self):
        from agentwatch.interceptor import _parse_json
        assert _parse_json(b"not-json") is None
        assert _parse_json("") is None


# ── Span emission ─────────────────────────────────────────────────────────────

class TestEmit:
    def test_emit_creates_valid_span(self):
        from agentwatch.interceptor import _emit
        import agentwatch.patcher as p
        p._proxy_url = "http://localhost:9999/ingest"
        p._api_key = "test-key"
        p._zero_data_retention = False

        spans = []
        with patch("agentwatch.patcher._send_span_async", side_effect=spans.append):
            _emit(
                url="https://api.openai.com/v1/chat/completions",
                provider="OpenAI",
                fmt="openai",
                req_body=_make_request_body(),
                resp_body=json.dumps(_make_openai_response()).encode(),
                status_code=200,
                start=time.time() - 0.5,
                end=time.time(),
            )

        assert len(spans) == 1
        s = spans[0]
        assert s["name"] == "openai.http"
        assert s["kind"] == "CLIENT"
        assert s["status"]["code"] == "OK"
        assert s["model_inference"]["provider"] == "OpenAI"
        assert s["model_inference"]["model_name"] == "gpt-4o"
        assert s["model_inference"]["prompt_tokens"] == 10
        assert s["model_inference"]["completion_tokens"] == 5
        assert len(s["trace_id"]) == 32
        assert len(s["span_id"]) == 16
        assert s["input"] == "What is ATP?"
        assert s["output"] == "Hello!"

    def test_emit_zdr_strips_input_output(self):
        from agentwatch.interceptor import _emit
        import agentwatch.patcher as p
        p._zero_data_retention = True
        try:
            spans = []
            with patch("agentwatch.patcher._send_span_async", side_effect=spans.append):
                _emit(
                    url="https://api.openai.com/v1/chat/completions",
                    provider="OpenAI",
                    fmt="openai",
                    req_body=_make_request_body(),
                    resp_body=json.dumps(_make_openai_response()).encode(),
                    status_code=200,
                    start=time.time() - 0.5,
                    end=time.time(),
                )
            s = spans[0]
            assert "input" not in s
            assert "output" not in s
        finally:
            p._zero_data_retention = False

    def test_emit_error_status_on_4xx(self):
        from agentwatch.interceptor import _emit
        import agentwatch.patcher as p
        p._zero_data_retention = False

        spans = []
        with patch("agentwatch.patcher._send_span_async", side_effect=spans.append):
            _emit(
                url="https://api.openai.com/v1/chat/completions",
                provider="OpenAI",
                fmt="openai",
                req_body=_make_request_body(),
                resp_body=b'{"error": "invalid api key"}',
                status_code=401,
                start=time.time() - 0.1,
                end=time.time(),
            )

        assert spans[0]["status"]["code"] == "ERROR"

    def test_emit_never_raises_on_garbage_body(self):
        """Observability must NEVER crash the host app."""
        from agentwatch.interceptor import _emit
        import agentwatch.patcher as p
        p._zero_data_retention = False

        with patch("agentwatch.patcher._send_span_async"):
            # Should not raise even with completely invalid data
            _emit(
                url="https://api.openai.com/v1/chat/completions",
                provider="OpenAI",
                fmt="openai",
                req_body=b"this is not json {{{",
                resp_body=b"also not json",
                status_code=200,
                start=time.time(),
                end=time.time(),
            )


# ── SDK deduplication ─────────────────────────────────────────────────────────

class TestDeduplication:
    def test_sdk_active_flag_suppresses_interceptor(self):
        """When SDK patcher is active, HTTP interceptor should skip."""
        from agentwatch.interceptor import _is_sdk_active, set_sdk_active
        assert not _is_sdk_active()
        set_sdk_active(True)
        assert _is_sdk_active()
        set_sdk_active(False)
        assert not _is_sdk_active()


# ── agent() context propagation ───────────────────────────────────────────────

class TestAgentContext:
    def test_agent_sets_context(self):
        from agentwatch.context import agent, current_agent
        assert current_agent() == {}
        with agent("ResearchBot", role="Researcher") as ctx:
            a = current_agent()
            assert a["agent_name"] == "ResearchBot"
            assert a["agent_role"] == "Researcher"
            assert a["agent_id"] == "researchbot"
        assert current_agent() == {}

    def test_agent_custom_id(self):
        from agentwatch.context import agent, current_agent
        with agent("MyBot", role="Worker", agent_id="custom-001"):
            assert current_agent()["agent_id"] == "custom-001"

    def test_agent_nesting(self):
        from agentwatch.context import agent, current_agent
        with agent("Outer", role="Orchestrator"):
            assert current_agent()["agent_name"] == "Outer"
            with agent("Inner", role="Worker"):
                assert current_agent()["agent_name"] == "Inner"
            assert current_agent()["agent_name"] == "Outer"

    def test_emit_uses_agent_context(self):
        from agentwatch.interceptor import _emit
        from agentwatch.context import agent
        import agentwatch.patcher as p
        p._zero_data_retention = False

        spans = []
        with patch("agentwatch.patcher._send_span_async", side_effect=spans.append):
            with agent("DataAnalyst", role="Analyst"):
                _emit(
                    url="https://api.groq.com/openai/v1/chat/completions",
                    provider="Groq",
                    fmt="openai_compat",
                    req_body=_make_request_body("llama3-70b-8192"),
                    resp_body=json.dumps(_make_openai_response()).encode(),
                    status_code=200,
                    start=time.time() - 0.2,
                    end=time.time(),
                )

        s = spans[0]
        assert s["agent_name"] == "DataAnalyst"
        assert s["agent_role"] == "Analyst"
        assert s["agent_id"] == "dataanalyst"


# ── httpx patch (unit — no real network) ─────────────────────────────────────

class TestHttpxPatch:
    def test_patch_httpx_is_idempotent(self):
        """patch_all() can be called multiple times without error."""
        from agentwatch.interceptor import patch_all
        patch_all()
        patch_all()  # second call must not raise

    def test_httpx_non_ai_passthrough(self):
        """Non-AI URLs should pass through without interceptor logic."""
        import httpx
        from agentwatch.interceptor import _patch_httpx
        _patch_httpx()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b'{"result": "ok"}'

        spans = []
        with patch("agentwatch.patcher._send_span_async", side_effect=spans.append):
            with patch("httpx.Client.send", return_value=mock_response):
                client = httpx.Client()
                req = httpx.Request("GET", "https://example.com/api/data")
                client.send(req)

        # No span should be emitted for non-AI URL
        assert len(spans) == 0
