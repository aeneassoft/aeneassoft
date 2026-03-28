# agentwatch · Python SDK

**Works with every AI framework. Automatically.**

One line of init. Every LLM call — from every library — is traced, attributed, and visible in your [PRODUCTNAME] dashboard.

```python
import agentwatch
agentwatch.init(api_key="your-key")

# That's it. Everything below is automatically intercepted:
openai_client.chat.completions.create(...)   # ✓ traced
anthropic_client.messages.create(...)        # ✓ traced
groq_client.chat.completions.create(...)     # ✓ traced
# LangChain, CrewAI, AutoGen, LlamaIndex     # ✓ all traced
```

---

## Installation

```bash
pip install agentwatch
```

**Requirements:** Python 3.8+, no mandatory dependencies beyond `httpx` (included).

---

## Framework compatibility

| Framework | Auto-traced | Notes |
|-----------|-------------|-------|
| OpenAI SDK | ✓ | SDK-level patch — full token counts |
| Anthropic SDK | ✓ | SDK-level patch — full token counts |
| Groq | ✓ | HTTP-level intercept |
| Mistral | ✓ | HTTP-level intercept |
| Google Gemini | ✓ | HTTP-level intercept |
| Cohere | ✓ | HTTP-level intercept |
| Together AI | ✓ | HTTP-level intercept |
| Fireworks AI | ✓ | HTTP-level intercept |
| Ollama (local) | ✓ | HTTP-level intercept |
| Azure OpenAI | ✓ | HTTP-level intercept |
| LangChain | ✓ | Intercepted via OpenAI/Anthropic SDK calls |
| CrewAI | ✓ | Intercepted via underlying SDK calls |
| AutoGen | ✓ | Intercepted via underlying SDK calls |
| LlamaIndex | ✓ | Intercepted via underlying SDK calls |
| Any httpx client | ✓ | Transport-level patch |
| Any requests client | ✓ | Adapter-level patch |
| Any aiohttp client | ✓ | Session-level patch |

---

## Quick start

```python
import agentwatch

agentwatch.init(
    api_key="your-api-key",
    proxy_url="http://localhost:8080/ingest",  # default
    zero_data_retention=False,                 # set True for GDPR strict mode
)
```

### Group calls into a trace

```python
with agentwatch.trace("research-pipeline", agent_id="pipeline-1") as trace_id:
    step1 = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Summarize this paper..."}],
    )
    step2 = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": step1.choices[0].message.content}],
    )
# Both calls share the same trace_id in your dashboard
```

### Tag calls with agent identity

```python
with agentwatch.agent("ResearchBot", role="Researcher"):
    result = groq_client.chat.completions.create(
        model="llama3-70b-8192",
        messages=[{"role": "user", "content": "Analyze this dataset..."}],
    )
# Span shows: agent_name="ResearchBot", agent_role="Researcher"
```

### Nested spans (CrewAI / AutoGen style)

```python
with agentwatch.trace("content-crew") as trace_id:
    with agentwatch.span("research-step", agent_id="researcher"):
        research = openai_client.chat.completions.create(...)

    with agentwatch.span("writing-step", agent_id="writer"):
        article = anthropic_client.messages.create(...)
```

---

## GDPR / Zero Data Retention

```python
agentwatch.init(api_key="key", zero_data_retention=True)
# Prompts and outputs are NEVER sent — only timestamps, token counts, latency
```

---

## How it works

`agentwatch` patches HTTP at **three levels**:

1. **SDK-level** (OpenAI, Anthropic) — wraps `Completions.create` / `Messages.create` directly for rich span data
2. **httpx** — patches `httpx.Client.send` and `httpx.AsyncClient.send` (used by most modern SDKs)
3. **requests** — patches `HTTPAdapter.send` (LangChain, older SDKs)
4. **aiohttp** — patches `ClientSession._request` (async-first frameworks)

Deduplication is built-in: SDK-level patches suppress HTTP-level intercepts for the same call.

---

## EU AI Act compliance

Every span includes `compliance_flags: ["eu_ai_act_art12_relevant"]` where applicable. Use the [PRODUCTNAME] dashboard to generate a Readiness Score and Article 12/13 compliance report.

---

## License

MIT
