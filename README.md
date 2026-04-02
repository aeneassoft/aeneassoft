<p align="center">
  <img src="https://raw.githubusercontent.com/aeneassoft/aeneassoft/master/assets/banner.svg" alt="AeneasSoft" width="800">
</p>

# AeneasSoft: The Proxy-Free Safe Pause & Resume Layer for AI Agents

Stop rogue agents in RAM, save their state, and resume safely. The elegant, in-process alternative to LiteLLM and Portkey. 2 lines of code. MIT Licensed.

<p>
  <a href="https://github.com/aeneassoft/aeneassoft/stargazers"><img src="https://img.shields.io/github/stars/aeneassoft/aeneassoft?style=flat&color=gold&logo=github" alt="Stars"></a>
  <a href="https://github.com/aeneassoft/aeneassoft/actions/workflows/ci.yml"><img src="https://github.com/aeneassoft/aeneassoft/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT"></a>
  <a href="https://pypi.org/project/aeneas-agentwatch/"><img src="https://img.shields.io/pypi/v/aeneas-agentwatch.svg" alt="PyPI"></a>
  <a href="https://www.npmjs.com/package/@aeneassoft/sdk-node"><img src="https://img.shields.io/npm/v/@aeneassoft/sdk-node.svg" alt="npm"></a>
</p>

---

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="https://raw.githubusercontent.com/aeneassoft/aeneassoft/master/assets/demo.png" />
    <img src="https://raw.githubusercontent.com/aeneassoft/aeneassoft/master/assets/demo.gif" alt="AeneasSoft — Safe Pause & Resume in Action" width="750" />
  </picture>
</p>

---

## Why AeneasSoft?

- **Safe Pause & Resume:** Block runaway agents in RAM, save state via `on_block` hook, resume from checkpoint. Not a kill switch — a safety layer.
- **In-Process, No Proxy:** Runs inside your application. No external proxy server, no network hop, no single point of failure. The elegant alternative to LiteLLM and Portkey.
- **Framework Agnostic:** Works at the HTTP transport layer, below every AI framework. OpenAI, Anthropic, Gemini, Mistral, Groq, Cohere — automatic.
- **EU AI Act Ready:** Automated Article 12 compliance reports with RSA-2048 signatures. Every circuit breaker state change is logged.

## Quickstart (30 seconds)

```bash
pip install aeneas-agentwatch
```

```python
import agentwatch
agentwatch.init()
# Every LLM call is now monitored. Rogue agents blocked in RAM.
```

**[Read the full documentation →](https://aeneassoft.com/en/docs)**

## Active Defense (Safe Pause & Resume)

Block runaway agents **in application memory** — then recover without losing state:

```python
# Advanced: Save state and pause instead of crashing
def save_state_and_pause(event):
    save_checkpoint(event.trace_id)        # Save your agent's state
    event.monitor.pause(60)                # Pause 60s, then probe

agentwatch.init(
    budget_per_hour=10.0,
    block_on_threshold=True,
    on_block=save_state_and_pause,         # Fires BEFORE exception
)

# Per-agent recovery:
try:
    with agentwatch.agent("ResearchBot", budget_per_hour=5.0, block_on_threshold=True):
        result = client.chat.completions.create(...)
except agentwatch.CircuitBreakerException as e:
    e.monitor.increase_budget(5)           # Raise budget and continue
    result = client.chat.completions.create(...)  # This call goes through
```

State Machine: `CLOSED` → `OPEN` → `PAUSED` → `HALF_OPEN` → `CLOSED` (or re-trip)

## Comparison

| | AeneasSoft | LiteLLM | Langfuse | Portkey |
|---|:---:|:---:|:---:|:---:|
| In-Process (No Proxy) | :white_check_mark: | :x: | :white_check_mark: | :x: |
| Active Circuit Breaker | :white_check_mark: | :white_check_mark: | :x: | :white_check_mark: |
| Safe Pause & Resume | :white_check_mark: | :x: | :x: | :x: |
| EU AI Act Reports | :white_check_mark: | :x: | :x: | :x: |
| Zero-Code Setup | :white_check_mark: | :x: | :x: | :x: |
| Open Source (MIT) | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: |

## Works With Every Framework

No plugins. No middleware. No wrappers. Just `import agentwatch; agentwatch.init()`.

**LangChain** · **CrewAI** · **AutoGen** · **LlamaIndex** · **Haystack** · **Semantic Kernel** · any custom code

> AeneasSoft operates at the HTTP transport layer — below every framework. If your code calls an AI API, we capture it. [See examples →](examples/python/)

## EU AI Act Compliance (Article 12)

Automated, signed compliance reports — ready for any audit.

```bash
# Generate Article 12 compliance report for a trace:
curl http://localhost:3001/api/traces/{trace_id}/compliance-report
# → RSA-2048 signed PDF. Tamper-proof. Audit-ready.
```

The EU AI Act Article 12 requirements apply from **August 2, 2026**. No other tool generates signed, audit-ready reports.

<details>
<summary><b>Architecture (Patent Pending)</b></summary>

AeneasSoft intercepts LLM calls in-process — before they reach the network. The circuit breaker uses a full state machine:

```
CLOSED → threshold exceeded → OPEN → pause(N) → PAUSED → timeout → HALF_OPEN
                                                                     ↓       ↓
                                                               probe OK   probe fails
                                                                  ↓          ↓
                                                               CLOSED      OPEN (re-trip)
```

The `on_block` hook fires before the exception propagates, giving your code a chance to save state (LangGraph checkpoints, custom snapshots). Every state transition is logged as an EU AI Act compliance event.

The AeneasSoft architecture — including In-Process Telemetry Interception and the Safe Pause & Resume State Machine — is protected by a USPTO Provisional Patent.

</details>

<details>
<summary><b>Node.js SDK</b></summary>

```bash
npm install @aeneassoft/sdk-node
```

```javascript
import { init } from '@aeneassoft/sdk-node';
init({ apiKey: 'local' });
```

</details>

<details>
<summary><b>Self-Hosting (Docker)</b></summary>

```bash
git clone https://github.com/aeneassoft/aeneassoft.git
cd aeneassoft
docker compose -f docker-compose.local.yml up -d
```

Verify it's running:
```bash
curl http://localhost:3001/health
```

Then connect the SDK:
```python
pip install aeneas-agentwatch
python -c "import agentwatch; agentwatch.init()"
# SDK auto-connects to localhost:3001. No API key needed in local mode.
```

**Full Stack (production):** `docker compose up -d` — adds Kafka + Proxy. Configure via `.env`.

</details>

<details>
<summary><b>Supported Providers</b></summary>

Works automatically with: **OpenAI, Anthropic, Gemini, Mistral, Groq, Cohere, Together AI, Fireworks, Azure OpenAI, Ollama** — and any provider accessible via HTTP.

Cost tracking for 20+ models with current list prices.

</details>

## What We Don't Do (Yet)

We believe in transparency over hiding behind "Beta" labels.

- **Prompt management / versioning** — not our focus, use LangSmith or Humanloop for that
- **A/B testing / evaluation pipelines** — we observe and protect, we don't evaluate
- **Streaming chunks:** captures request + final usage summary, not individual chunks (full chunk-level tracing Q3 2026)
- **Cost precision:** list prices for 20+ models — batch API, cached tokens, and fine-tuned rates are not reflected

## License

MIT License — the SDK, circuit breaker, state machine, and dashboard are all open source.

The **AeneasSoft architecture** — including In-Process Telemetry Interception and the Safe Pause & Resume State Machine — is protected by a USPTO Provisional Patent.

---

If this is useful, **please [star this repo](https://github.com/aeneassoft/aeneassoft)** — it helps us reach more developers.

<p align="center">
  <a href="https://discord.gg/Y9x6jf3cnu"><img src="https://img.shields.io/badge/Discord-Join_the_Community-5865F2?logo=discord&logoColor=white&style=for-the-badge" alt="Discord"></a>
</p>

- [Discord](https://discord.gg/Y9x6jf3cnu)
- [Website](https://aeneassoft.com)
- [Docs](https://aeneassoft.com/en/docs)
- [PyPI](https://pypi.org/project/aeneas-agentwatch/)
- [npm](https://www.npmjs.com/package/@aeneassoft/sdk-node)
