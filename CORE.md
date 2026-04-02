# AeneasSoft — Product Core

This document defines what AeneasSoft IS. Every feature, every line of code, every marketing message must trace back to one of these three pillars. If it doesn't serve a pillar, it doesn't belong in the product.

---

## The Three Pillars

### 1. Dual-Layer Interception with Deduplication

**What it is:** We patch both the SDK layer (OpenAI/Anthropic `create()` methods) AND the HTTP transport layer (httpx, requests, aiohttp, node:http/https) simultaneously. A coordination flag (thread-local + ContextVar) prevents the same API call from being logged twice.

**Why it matters:** Every other tool picks one layer. LangSmith uses callbacks (SDK-only, framework-locked). Helicone uses a proxy (HTTP-only, external). We do both, coordinated, in-process. This means we capture everything — no matter what framework sits on top — without duplicating data.

**The sentence:** "Two lines of code. Every LLM call captured. No framework lock-in. No duplicates."

---

### 2. In-Process Active Defense (Circuit Breaker)

**What it is:** Before an HTTP request leaves application memory, we check: Is the budget exceeded? Is the error rate too high? Is the agent stuck in a loop? If yes, we raise a `CircuitBreakerException` — the request never reaches the network.

**Why it matters:** Every other tool is passive — they observe after the fact. Proxies like Helicone block at the gateway, which means the request already left the application, already consumed a network roundtrip, and relies on an external service being available. We block in the process itself. Faster. More granular. No single point of failure.

**The sentence:** "In-process blocking before the request ever leaves application memory. No proxy. No network roundtrip. No single point of failure."

---

### 3. Audit-Ready EU AI Act Article 12 Reports

**What it is:** Automatic compliance scoring against EU AI Act Article 12 (record-keeping) and Article 13 (transparency), with cryptographically signed (RSA-2048) PDF reports that can be handed to an auditor.

**Why it matters:** The EU AI Act Article 12 requirements apply from August 2, 2026. No other observability tool generates signed, audit-ready compliance reports. Langfuse gives you raw logs. LangSmith gives you dashboards. We give you a PDF with a cryptographic signature that proves the data hasn't been tampered with.

**The sentence:** "One-click signed PDF reports for any audit. Be ready by design, not by panic."

---

## What We Are NOT

- We are NOT a prompt management tool (no versioning, no A/B testing)
- We are NOT an evaluation platform (no scoring pipelines, no dataset management)
- We are NOT a fine-tuning tool
- We are NOT a general-purpose APM (we only care about AI/LLM calls)

If someone asks for these features, the answer is: "That's not our product. Use Langfuse/LangSmith for that. Use us for the three things nobody else does."

---

## The Competitive Moat

| What we do | Nearest competitor | Why we're different |
|---|---|---|
| Dual-Layer Dedup | OpenTelemetry | OTel has no AI awareness, no SDK/HTTP coordination flag |
| In-Process Blocking | Helicone/Portkey | They block at the proxy (after network). We block in RAM (before network) |
| Signed Compliance PDFs | Nobody | Langfuse/LangSmith have no Article 12 reports |
| Framework-agnostic | LangSmith | LangSmith requires LangChain. We work with anything that uses HTTP |
| 2-line setup | Everyone else | Langfuse needs callbacks. Helicone needs base_url change. We need `init()` |

---

## Decision Framework

When building a new feature, ask:

1. **Does it strengthen a pillar?** If yes, build it.
2. **Does it serve an adjacent need that makes a pillar more valuable?** (e.g., better dashboard for viewing traces makes Pillar 1 more useful) If yes, build it.
3. **Is it a completely separate capability?** (e.g., prompt versioning, A/B testing) Don't build it. Stay focused.

When writing marketing copy, ask:

1. **Does this sentence explain why we're different from Langfuse/LangSmith/Helicone?** If not, rewrite it.
2. **Would a CTO read this and immediately understand the value?** If not, simplify it.
3. **Can a competitor copy-paste this claim?** If yes, it's not specific enough.

---

## Honest Boundaries

We believe transparency about limitations builds more trust than pretending they don't exist. These are the things we don't do, or don't do perfectly yet.

### What works with 100% accuracy
- Non-streaming LLM calls (request → response → span with tokens, cost, latency)
- SDK-level calls (OpenAI `create()`, Anthropic `create()`) with rich structured data
- HTTP-level calls to all 9+ AI providers (httpx, requests, aiohttp, node:http/https)
- Deduplication between SDK and HTTP layers (no duplicate spans)
- In-process circuit breaker (budget, error rate, loop detection)

### What works partially
- **Streaming calls (stream=True):** We capture the initial request and final usage summary (tokens + cost), but not individual chunks. You'll see the trace with correct cost — but not the real-time token stream. Full chunk-level streaming tracing is scheduled for Q3 2026.
- **Cost calculation:** We use list prices for 20+ models. Batch API pricing, cached token discounts, and fine-tuned model rates are not reflected. Our cost numbers are accurate estimates, not exact invoices.

### What we don't do
- **Prompt management / versioning** — not our product. Use LangSmith or Humanloop.
- **A/B testing / evaluation pipelines** — not our product. Use Braintrust or Langfuse.
- **Multi-process central configuration** — each process needs its own `init()` call. In Kubernetes, each pod initializes independently. This is a trade-off of in-process architecture vs. proxy-based tools like Helicone.
- **Monkey-patching stability guarantee** — we modify HTTP library internals at runtime. When libraries release major versions (e.g., httpx 2.0), our patchers may need updates. We test against pinned versions and release SDK updates within 48 hours of breaking changes.

### Why we publish this
Because every other tool hides their limitations behind "Beta" labels. We'd rather tell you exactly what works and what doesn't so you can make an informed decision.

---

## The One-Paragraph Pitch

AeneasSoft is the only AI agent observability tool that captures every LLM call at the HTTP transport level without framework lock-in, actively blocks runaway agents in application memory before they drain your budget, and generates cryptographically signed EU AI Act Article 12 compliance reports — all with two lines of code. Patent pending.
