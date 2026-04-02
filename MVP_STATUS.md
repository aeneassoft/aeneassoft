# AeneasSoft — Vollständiger MVP Status Report

**Stand:** 2026-03-28
**Ziel:** Investor-Pitch-Ready MVP für AI Agent Observability
**Live:** api.aeneassoft.com (Backend) + aeneassoft.com (Website/Playground)
**PyPI:** https://pypi.org/project/aeneas-agentwatch/0.1.0/

---

## Was das Produkt ist

AeneasSoft ist ein Agent Observability Tool: Es beobachtet, debuggt und auditiert Multi-Agenten-KI-Systeme. Herzstück ist das Agent Trace Protocol (ATP) — ein offener NDJSON-basierter Telemetrie-Standard.

**Kern-Differenzierung:** Universeller HTTP-Layer-Interceptor. Kein Framework-Lock-in, keine Proxy-Architektur im kritischen Pfad, kein manuelles Instrumentieren. 2 Zeilen Code, fertig.

---

## Quickstart (funktioniert weltweit)

```bash
pip install aeneas-agentwatch
export AGENTWATCH_API_KEY=aw_your_key
```

```python
import agentwatch
agentwatch.init()
# Jeder LLM-Call wird automatisch getracet
```

**Wichtig:** Das PyPI-Package heißt `aeneas-agentwatch`, der Import bleibt `import agentwatch`.

---

## Architektur

```
User's Python/Node App
    ↓ (agentwatch SDK — HTTP-layer monkey-patching)
    ↓ Spans gesendet an:
Proxy (Fastify, Port 8080)
    ↓ Kafka (agent-traces topic)
    ↓
Backend API (Fastify, Port 3001)
    ↓
ClickHouse (Trace Storage, 30-day TTL)
    ↓
REST API → Website Playground / Custom Dashboards
```

---

## Infrastruktur (Live auf Hetzner)

| Service | Port | Technologie | Status |
|---------|------|-------------|--------|
| Backend API | 3001 | Fastify/TypeScript | ✅ Live auf api.aeneassoft.com |
| Proxy | 8080 | Fastify/TypeScript | ✅ Live |
| Kafka | 9092 | Confluent KRaft | ✅ Running |
| ClickHouse | 8123 | ClickHouse 23.8 | ✅ Running |
| Website | — | Next.js 14 auf Vercel | ✅ Live auf aeneassoft.com |

**Server:** Hetzner CX22, Ubuntu 22.04, Caddy HTTPS, Let's Encrypt

---

## REST API — 14 Endpoints (alle live)

| Method | Endpoint | Auth | Funktion |
|--------|----------|------|----------|
| GET | `/health` | Nein | Health check |
| GET | `/api/traces` | Ja | Traces (paginiert, filterbar: status, agent_id, model, from, to) |
| GET | `/api/traces/:id/graph` | Ja | Kausaler Graph (Nodes + Edges + Kosten) |
| GET | `/api/traces/:id/spans` | Ja | Alle Spans eines Traces |
| GET | `/api/traces/:id/compliance-score` | Ja | EU AI Act Score (0-100, 7 Checks) |
| GET | `/api/traces/:id/compliance-report` | Ja | RSA-2048 signierter PDF-Report |
| GET | `/api/metrics` | Ja | KPIs (Error Rate, Kosten, Latenz) |
| GET | `/api/cost/daily` | Ja | Tägliche Kostenentwicklung |
| GET | `/api/cost/by-agent` | Ja | Kosten pro Agent |
| GET | `/api/cost/by-model` | Ja | Kosten pro Modell |
| POST | `/api/ingest` | Ja | Direkte Span-Ingestion (ATP-Format) |
| POST | `/api/keys` | Ja | API-Key erstellen (Multi-Tenant) |
| GET | `/api/keys` | Ja | API-Keys auflisten |

Trace-Response enthält `span_count` pro Trace + `total` für Pagination.

---

## SDKs

### Python SDK (`aeneas-agentwatch` auf PyPI)

- **Install:** `pip install aeneas-agentwatch`
- **Import:** `import agentwatch` (unverändert)
- SDK-Level Patching: OpenAI + Anthropic (sync + async)
- HTTP-Level Interceptor: httpx, requests, aiohttp
- 10 Provider: OpenAI, Anthropic, Gemini, Mistral, Groq, Cohere, Together AI, Fireworks AI, Azure OpenAI, Ollama
- `agent()` Context Manager (ContextVar, asyncio-safe)
- `trace()` + `span()` für manuelle Gruppierung
- Zero Data Retention: `agentwatch.init(zero_data_retention=True)`
- Default URL: `https://proxy.aeneassoft.com/ingest`
- API Key: optional, liest `AGENTWATCH_API_KEY` Env

### Node.js SDK (`@aeneassoft/sdk-node`)

- Patcht `node:http` + `node:https` Core-Level
- Gleiche 10 Provider, SDK-Level Patches für OpenAI + Anthropic

### ATP Schema (`@aeneassoft/atp-schema`)

- Zod-basiert, npm-publishbar, MIT

---

## Backend-Engines

### Causal Graph Engine
- DAG aus ATP-Spans, Out-of-Order-Buffering (5s Orphan-Timeout)
- Parent-Child + Causal Link Edges
- React Flow kompatibel, dual-format (ATP + ClickHouse flach)

### Cost Attribution Engine
- 20+ Modelle mit Pricing (GPT-4o, Claude, Mistral, Groq/Llama3, Gemini, Cohere)
- Erweiterbar via `MODEL_PRICING` Env (JSON)
- Materialized View für tägliche Rollups

### Compliance Score Engine
- 7 Checks, 100 Punkte: Art. 12 (Record-Keeping, Reasoning, Logging, Errors) + Art. 13 (Identity, Transparency) + Cost Attribution
- Levels: HIGH (≥75), MEDIUM (40-74), LOW (<40)

### PDF Report Generator
- RSA-2048 kryptographische Signatur
- SHA-256 Integrity Hash + Key Fingerprint
- Compliance Score Summary, Art. 12 + 13, Audit-Trail, Kosten, Legal Disclaimer

---

## Sicherheit

- SHA-256 Timing-Safe Auth (`timingSafeEqual`)
- Multi-Tenant API Keys (ClickHouse `api_keys` Tabelle)
- SQL Injection: Strict Regex Allowlists
- Rate Limiting: Backend 1000/min, Proxy 200/min
- Error Disclosure: Interne Details gestrippen
- CORS: Explizite Origin-Allowlist
- Zod-Validierung auf Ingest
- Body Limits: 1MB/512KB
- Firewall: nur 22, 80, 443
- 0 HIGH/CRITICAL npm Vulnerabilities

---

## Tests: 64 grün

| Suite | Tests |
|-------|-------|
| ATP Schema | 5 |
| Proxy | 3 |
| Causal Graph | 6 |
| Cost Attribution | 4 |
| Compliance Score | 7 |
| Auth Middleware | 5 |
| Python Patcher | 7 |
| Python Interceptor | 27 |

---

## Website (aeneassoft.com)

- Landing, Product, Playground, Docs, Pricing, About, Investors, Blog, Legal
- EN + DE (i18n)
- **Playground:** Demo-Modus (Gold Toggle, 3 hardcoded Pipelines) + Live-Modus (Blue Toggle, echte API-Daten)
- Responsive ab 768px side-by-side
- Alle technischen Claims verifiziert und korrigiert

---

## Verifizierte Simulation (5 Pipelines, 23 Spans, live auf api.aeneassoft.com)

| Pipeline | Agents | Score |
|----------|--------|-------|
| EU AI Act Compliance Audit | 5 | 100/100 HIGH |
| Customer Support Ticket | 4 | 70/100 MEDIUM |
| Market Research | 4 | 70/100 MEDIUM |
| Code Review (ERROR) | 5 | 70/100 MEDIUM |
| Content Generation Crew | 5 | 70/100 MEDIUM |

---

## Framework-Kompatibilität (14 Frameworks)

OpenAI, Anthropic, LangChain, CrewAI, AutoGen, LlamaIndex, Groq, Mistral, Gemini, Azure OpenAI, Ollama, httpx, requests, aiohttp

---

## Commit History

```
d2bebd3 feat: publish aeneas-agentwatch 0.1.0 to PyPI
2f70e1a fix: span_count per trace in API response
a8c0823 fix: pricing keys, pagination, graph rendering, agent simulation
0c5f60a feat: investor-ready MVP — multi-tenant auth, FinOps API, crypto-signed reports
9bad17f refactor: strip to core product — SDK + Proxy + Backend API, no frontend
e615f99 feat: universal HTTP interceptor — works with every AI framework
```

---

## Nicht implementiert (bewusst)

- Billing/Stripe (nicht nötig für Pitch)
- OAuth/JWT (API-Key reicht)
- Alerting/Webhooks (Post-MVP)
- npm publish Node SDK (ready, nicht deployed)
