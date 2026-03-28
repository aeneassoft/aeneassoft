# [PRODUCTNAME] by Aeneassoft

> Works with every AI framework. Automatically.
> 2 lines of code. Zero config. Every agent traced.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Install

```bash
pip install agentwatch
```

## Usage

```python
import agentwatch
agentwatch.init(api_key="your-key")

# Done. Every LLM call is now traced automatically.
import openai
client = openai.OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}]
)
```

Traces are sent to `http://localhost:8080/ingest` by default. Query them via the REST API:

```bash
curl -H "X-API-Key: your-key" http://localhost:3001/api/traces
```

---

## Self-Host

**Requirements:** Docker + Docker Compose

```bash
git clone https://github.com/aeneassoft/productname
cd productname
cp .env.example .env    # set API_KEY
docker compose up -d
docker compose ps       # verify all 4 services healthy
curl http://localhost:3001/health
```

4 services:

| Service | Port | Purpose |
|---------|------|---------|
| **proxy** | 8080 | Intercepts AI requests, forwards spans to Kafka |
| **backend** | 3001 | REST API — traces, graphs, compliance reports |
| **kafka** | 9092 | Message queue (proxy → backend) |
| **clickhouse** | 8123 | Trace storage (30-day TTL by default) |

---

## REST API

All `/api/*` endpoints require `X-API-Key: <your-key>` header.

```
GET  /health                                  # no auth required
GET  /api/traces                              # last 50 traces
GET  /api/traces/:trace_id/spans             # all spans for a trace
GET  /api/traces/:trace_id/graph             # causal graph (nodes + edges + costs)
GET  /api/traces/:trace_id/compliance-score  # EU AI Act readiness score (0-100)
GET  /api/traces/:trace_id/compliance-report # PDF (Article 12 + 13)
GET  /api/metrics                             # KPIs (error rate, cost, latency)
POST /api/ingest                              # direct span ingestion (ATP format)
```

---

## SDK — Python

```python
import agentwatch

agentwatch.init(
    api_key="your-key",
    proxy_url="http://localhost:8080/ingest",  # default
    zero_data_retention=False,                 # True = GDPR strict mode
)
```

**Tag calls with agent identity:**

```python
with agentwatch.agent("ResearchBot", role="Researcher"):
    result = openai_client.chat.completions.create(...)
    # span.agent_name = "ResearchBot" in the trace
```

**Group calls into a named trace:**

```python
with agentwatch.trace("my-pipeline", agent_id="pipeline-1") as trace_id:
    step1 = openai_client.chat.completions.create(...)
    step2 = anthropic_client.messages.create(...)
    # Both calls share the same trace_id
```

## SDK — Node.js

```typescript
import { init } from '@aeneassoft/sdk-node';
init({ apiKey: 'your-key' });
// All LLM calls are now traced
```

---

## Framework Compatibility

| Framework | How it's traced |
|-----------|----------------|
| OpenAI SDK | SDK-level patch |
| Anthropic SDK | SDK-level patch |
| LangChain | via OpenAI/Anthropic SDK |
| CrewAI | via OpenAI/Anthropic SDK |
| AutoGen | via OpenAI/Anthropic SDK |
| LlamaIndex | via OpenAI/Anthropic SDK |
| Groq | HTTP interceptor |
| Mistral | HTTP interceptor |
| Google Gemini | HTTP interceptor |
| Azure OpenAI | HTTP interceptor |
| Ollama | HTTP interceptor |
| Any httpx/requests/aiohttp client | HTTP interceptor |

---

## GDPR / Zero Data Retention

```python
agentwatch.init(api_key="key", zero_data_retention=True)
# Prompts and outputs are NEVER stored — only timestamps, token counts, latency.
```

Set `ZERO_DATA_RETENTION=true` in `.env` to enforce server-side.

---

## EU AI Act Compliance

Every span is automatically evaluated against Article 12 (record-keeping) and Article 13 (transparency). Get a readiness score and downloadable PDF report:

```bash
# Score (0-100)
curl -H "X-API-Key: key" localhost:3001/api/traces/:id/compliance-score

# PDF report
curl -H "X-API-Key: key" localhost:3001/api/traces/:id/compliance-report -o report.pdf
```

---

## ATP Schema (Open Standard)

```bash
npm install @aeneassoft/atp-schema
```

Agent Trace Protocol — an open NDJSON telemetry standard for multi-agent AI. See [`packages/atp-schema/README.md`](packages/atp-schema/README.md).

---

## Examples

See [`examples/`](examples/):

- [`examples/python/basic.py`](examples/python/basic.py)
- [`examples/python/with_context.py`](examples/python/with_context.py) — agent tags
- [`examples/python/crewai_example.py`](examples/python/crewai_example.py) — CrewAI zero-config
- [`examples/python/multi_provider.py`](examples/python/multi_provider.py) — OpenAI + Anthropic + Groq
- [`examples/node/basic.ts`](examples/node/basic.ts)
- [`examples/node/with_trace.ts`](examples/node/with_trace.ts)

---

## Development

```bash
npm install
npm run test --workspaces --if-present
pytest sdks/python/tests -v

docker compose up -d
npm run dev   # starts proxy + backend in watch mode
```

---

## Open Source vs Enterprise

| Feature | MIT | Enterprise |
|---------|:---:|:----------:|
| ATP Schema & Protocol | ✓ | ✓ |
| API Proxy | ✓ | ✓ |
| Python & Node.js SDKs | ✓ | ✓ |
| Causal Graph API | ✓ | ✓ |
| EU AI Act Compliance Reports | ✓ | ✓ |
| Cost Attribution | ✓ | ✓ |
| Self-Hosted | ✓ | ✓ |
| Managed Cloud | | ✓ |
| Priority Support + SLA | | ✓ |
| Advanced Alerting | | ✓ |
| RBAC + SSO | | ✓ |

---

## License

MIT. See [LICENSE](LICENSE). Built by [Aeneassoft](https://aeneassoft.com).
