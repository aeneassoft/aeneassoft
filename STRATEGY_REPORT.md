# AeneasSoft — Strategischer Kontext-Export (FINAL)

**Stand:** 2026-03-28, 16:00 UTC
**Zweck:** Briefing für externe Strategie-Analyse + Investor-Pitch
**Erstellt von:** Claude Opus 4.6 auf Basis vollständiger Codebase- + Website-Analyse

---

## 1. AKTUELLER STAND

### Commits
```
d2bebd3 feat: publish aeneas-agentwatch 0.1.0 to PyPI
2f70e1a fix: span_count per trace in API response (parallel batch query)
a8c0823 fix: pricing keys, pagination, graph rendering, agent simulation
0c5f60a feat: investor-ready MVP — multi-tenant auth, FinOps API, crypto-signed reports, security hardening
9bad17f refactor: strip to core product — SDK + Proxy + Backend API, no frontend
e615f99 feat: universal HTTP interceptor — works with every AI framework
12233f5 fix: upgrade fastify plugins to v5-compatible versions
ed02c3e chore: wire API_KEY env var into backend container
819d2e9 feat: initial AeneasSoft MVP — 30 tests passing, auth middleware, clean audit
```

### Zahlen
- **47 Source-Dateien** (TypeScript + Python)
- **64 Tests** (30 TS + 34 Python) — alle grün
- **0 HIGH/CRITICAL** npm Vulnerabilities
- **14 REST Endpoints** live auf api.aeneassoft.com
- **PyPI:** `pip install aeneas-agentwatch` v0.1.0 (Import: `import agentwatch`)
- **ATP Schema:** v1.0.0 npm-ready

### Live-Infrastruktur
| Service | Technologie | Status |
|---------|-------------|--------|
| Backend API | Fastify/TS auf Hetzner CX22 | ✅ api.aeneassoft.com |
| Proxy | Fastify/TS | ✅ intern auf Port 8080 |
| Kafka | Confluent KRaft | ✅ Running |
| ClickHouse | 23.8 | ✅ Running, 30-day TTL |
| Website | Next.js 14 auf Vercel | ✅ aeneassoft.com |
| HTTPS | Caddy + Let's Encrypt | ✅ Automatisch |
| PyPI | aeneas-agentwatch 0.1.0 | ✅ Weltweit installierbar |

---

## 2. WAS IMPLEMENTIERT IST (vollständig)

### Backend (api.aeneassoft.com)

**14 REST Endpoints:**
| Endpoint | Funktion |
|----------|----------|
| `GET /health` | Health check (kein Auth) |
| `GET /api/traces` | Paginiert + filterbar (limit, offset, status, agent_id, model, from, to) + `span_count` + `total` |
| `GET /api/traces/:id/graph` | Kausaler Graph: Nodes + Edges + Kosten + dual-format (ATP + ClickHouse) |
| `GET /api/traces/:id/spans` | Alle Spans eines Traces |
| `GET /api/traces/:id/compliance-score` | EU AI Act Score 0-100, 7 Checks, HIGH/MEDIUM/LOW |
| `GET /api/traces/:id/compliance-report` | RSA-2048 signiertes PDF (Art. 12 + 13 + Audit-Trail) |
| `GET /api/metrics` | KPIs: Error Rate, Kosten, Latenz (24h) |
| `GET /api/cost/daily` | ClickHouse Materialized View Rollup |
| `GET /api/cost/by-agent` | Kosten pro Agent aggregiert |
| `GET /api/cost/by-model` | Kosten pro Modell aggregiert |
| `POST /api/ingest` | ATP Span Ingestion (Zod-validiert) |
| `POST /api/keys` | Multi-Tenant API Key erstellen (`aw_` Prefix) |
| `GET /api/keys` | Keys auflisten (nur Hash-Prefix sichtbar) |

**Engines:**
- **Causal Graph:** DAG-Builder mit Orphan-Buffering (5s), Parent-Child + Causal Link Edges, React Flow kompatibel
- **Cost Attribution:** 20+ Modelle mit Pricing (GPT-4o, Claude, Mistral, Groq/Llama3, Gemini, Cohere), ENV-Override
- **Compliance Score:** 7 Checks (Art. 12: Record-Keeping, Reasoning, Logging, Errors; Art. 13: Identity, Transparency; General: Cost)
- **PDF Report:** RSA-2048 Signatur, SHA-256 Hash, Key Fingerprint, Compliance Score Summary, Legal Disclaimer

**Sicherheit:**
- SHA-256 Timing-Safe Auth (`timingSafeEqual`)
- Multi-Tenant API Keys (ClickHouse `api_keys`, org_id Isolation)
- SQL Injection: Strict Regex Allowlists (kein String-Interpolation)
- Rate Limiting: Backend 1000/min, Proxy 200/min
- CORS: Explizite Origin-Allowlist
- Zod-Validierung auf Ingest
- Firewall: nur 22, 80, 443

### Python SDK (PyPI: aeneas-agentwatch)

```python
pip install aeneas-agentwatch

import agentwatch
agentwatch.init()  # Liest AGENTWATCH_API_KEY Env-Variable
```

- SDK-Level Patching: OpenAI + Anthropic (sync + async)
- HTTP-Layer Interceptor: httpx, requests, aiohttp auf Transport-Ebene
- 10 Provider automatisch erkannt: OpenAI, Anthropic, Gemini, Mistral, Groq, Cohere, Together AI, Fireworks AI, Azure OpenAI, Ollama
- `agent()` Context Manager (ContextVar, asyncio-safe)
- `trace()` + `span()` für Gruppierung
- Zero Data Retention: `agentwatch.init(zero_data_retention=True)`
- Deduplication: SDK-Patches suppressen HTTP-Interceptor
- Default URL: `https://proxy.aeneassoft.com/ingest`

### Node.js SDK
- Patcht `node:http` + `node:https` Core-Level
- Gleiche 10 Provider, SDK-Level Patches für OpenAI + Anthropic
- npm-ready (nicht published)

### Website (aeneassoft.com)

**Seiten:**
- Landing (`/`) — Hero, Code-Snippet, Framework-Badges, CTA
- Product (`/product`) — Drei Perspektiven: High Schooler / Developer / CTO
- Playground (`/playground`) — Demo + Live Modi (siehe unten)
- Docs (`/docs`) — Quickstart, Framework Guides, API Reference, Security
- Pricing (`/pricing`) — Open Source / Pro (Coming Soon) / Enterprise
- Investors (`/investors`) — Market $6.8B, EU AI Act, Investment Thesis
- About (`/about`) — Team, Mission
- Legal — Privacy, AGB, Impressum
- Login (`/login`) — Standalone (kein Navbar/Footer)

**Sprachen:** EN + DE (i18n via JSON Dictionaries, `app/[lang]/` Routing)

**Design:**
- Animated Background mit Circuit Pattern
- Glassmorphism Cards + Navbar
- Hero Gradient Text + CTA Pulsing Glow
- Spartan-Helm Logo mit Gold Ring + Circuit Traces
- Responsive ab 768px (md Breakpoint)

**Playground — Kernstück der Investor-Demo:**

| Feature | Demo-Modus (Gold) | Live-Modus (Blue) |
|---------|-------------------|-------------------|
| Datenquelle | 3 hardcoded Pipelines | Echte API-Daten von ClickHouse |
| Simulation | Nicht nötig | "Run Demo Simulation" Button (lokal, keine API-Calls) |
| Isolation | Client-only | Simulation: Client-only. Echte Daten: geteilte DB |
| Causal Graph | ✅ React Flow + Dagre | ✅ Identisch |
| Compliance Score | ✅ Ring + Checks | ✅ Identisch |
| PDF Download | ✅ Client-generiert | ✅ Server-generiert (RSA-signiert) ODER Client-generiert (Sim) |
| Node-Sidebar | ✅ Agent-Details | ✅ Identisch |
| Parallele Investoren | ✅ Unbegrenzt | ✅ Sim: unbegrenzt (lokal). Echte Daten: geteilt |

**"Run Demo Simulation" Button:**
- Generiert 3-5 von 15 verschiedenen Pipeline-Templates
- Jitter auf Tokens, Kosten, Scores, Latenz — jeder Run sieht anders aus
- Neue UUIDs pro Run (crypto.getRandomValues)
- Kein API-Call, keine Datenbank, rein client-seitig
- Immer sichtbar in der Sidebar (nicht nur Empty State)
- Mehrfach klickbar — jeder Klick generiert neue Daten

**Technische Korrektheit aller Website-Claims:**
- ATP Schema: echtes JSON mit `model_inference`, `cost_attribution`, `compliance_flags`
- 10 Provider korrekt gelistet
- "RSA-2048 + SHA-256 signed" — implementiert
- Helicone-Vergleich: "HTTP-layer interception, kein Proxy im kritischen Pfad"
- Self-hosted: "Docker Compose, ClickHouse, Kafka, JSON/PDF API"
- Quickstart: `pip install aeneas-agentwatch` (korrekter Name)

---

## 3. WAS NOCH FEHLT FÜR SCALE (1 → 100 Kunden)

### Infrastruktur
| Baustein | Aufwand | Priorität |
|----------|---------|-----------|
| ClickHouse Cluster (2+ Nodes) | 3-5 Tage | Bei >10K spans/sec |
| Kafka Multi-Partition | 1-2 Tage | Bei >50 parallele Kunden |
| Load Balancer | 1 Tag | Bei 2+ Server |
| Monitoring (Prometheus + Grafana) | 2-3 Tage | Sofort nach erstem Kunden |
| Backup/Restore ClickHouse | 1 Tag | Sofort |
| CI/CD (GitHub Actions → Hetzner) | 2 Tage | Sofort |

### Features
| Feature | Aufwand | Priorität |
|---------|---------|-----------|
| User Management + Dashboard | 10-15 Tage | Vor Enterprise-Sales |
| Alerting (Webhook + Email) | 5-7 Tage | Top Enterprise-Request |
| Data Export (CSV, JSONL) | 2-3 Tage | Compliance-Teams |
| Retention per Org | 3-4 Tage | Enterprise-Anforderung |
| Billing (Stripe) | 5-7 Tage | Für Pro-Tier |
| SSO (SAML/OIDC) | 5-7 Tage | Enterprise Sales-Blocker |

### Developer Experience
| Lücke | Aufwand |
|-------|---------|
| Node SDK auf npm publishen | 1 Tag |
| Go SDK | 5-7 Tage |
| CLI Tool (`agentwatch traces list`) | 3-5 Tage |
| OpenTelemetry Bridge | 5-7 Tage |
| Grafana Plugin | 3-5 Tage |

### Security/Compliance
| Lücke | Aufwand |
|-------|---------|
| Kafka SASL/SSL | 2-3 Tage |
| Audit Log | 2-3 Tage |
| Docker non-root | 1 Tag |
| SOC2 / ISO 27001 | Monate (Prozess) |
| Penetration Test | Extern beauftragen |

---

## 4. FREELANCER-ANALYSE

| Bereich | Skill-Level | Einarbeitung | Risiko | Empfehlung |
|---------|------------|-------------|--------|------------|
| Frontend/Website | Mid React/Next.js | 1-2 Tage | NIEDRIG | Sehr gut geeignet — entkoppelt vom Backend |
| SDK weitere Sprachen (Go, Java) | Senior + HTTP-Internals | 2-3 Tage | MITTEL | Gut mit klarer Spec |
| Framework-Integrationen | Senior Python + Framework-Wissen | 3-5 Tage | HOCH | Nur bei Kundenbedarf |
| Docs/Content | Technical Writer | 1 Tag | NIEDRIG | Sehr gut geeignet |
| DevOps/Infra | Senior DevOps | 2-3 Tage | HOCH | Nur mit Review-Prozess |

---

## 5. DIE NÄCHSTEN 90 TAGE

### Woche 1-2: Enterprise-Readiness
- Node SDK auf npm (1 Tag)
- CI/CD Pipeline (2 Tage)
- Monitoring: Prometheus + Grafana (2 Tage)
- Alerting API: Threshold + Webhook (3 Tage)
- ClickHouse Backup (1 Tag)
- Docker non-root + Kafka SSL (3 Tage)

### Woche 3-4: Onboarding & Self-Service
- Self-Service Key-Management UI (5 Tage)
- Quickstart Wizard: "Welches Framework?" → Code (3 Tage)
- Data Export API: CSV/JSONL (2 Tage)
- OpenAPI/Swagger auto-generiert (1 Tag)
- Retention per Org (2 Tage)

### Monat 2: FinOps & Scale
- Cost Dashboard Widgets (Freelancer Frontend, 7 Tage)
- Budget-Alerts (3 Tage)
- Go SDK (Freelancer, 7 Tage)
- ClickHouse Cluster (3 Tage)
- Stripe Pro-Tier (5 Tage)

### Monat 3: Enterprise
- SSO/OIDC (5 Tage)
- Team/Org Management UI (5 Tage)
- Audit Log (3 Tage)
- Grafana Plugin (Freelancer, 5 Tage)
- SOC2 Vorbereitung starten
- Erste Enterprise-Onboardings

### Kapazität
- **Claude Code:** ~60% Feature-Arbeit (Backend, SDK, API, Security)
- **Freelancer 1 (Frontend):** ab Woche 1
- **Freelancer 2 (DevOps/Go):** ab Woche 2

---

## 6. DER EINE SATZ

> AeneasSoft ist ein Open-Source Agent Observability Tool das über einen universellen HTTP-Layer-Interceptor jede LLM-Interaktion in Multi-Agenten-Systemen automatisch tracet, kausal verknüpft, kostenattribuiert und EU AI Act-konform dokumentiert — installierbar mit `pip install aeneas-agentwatch` und zwei Zeilen Code, ohne Framework-Lock-in.

---

## 7. INVESTOR-DEMO FLOW

Ein Investor der aeneassoft.com besucht erlebt folgendes:

1. **Landing Page** — sieht "Works with every AI framework. Automatically." + Code-Snippet + Framework-Badges
2. **Klickt "Playground"** — landet im Demo-Modus (Gold Toggle)
3. **Sieht 3 Pipelines** — klickt "EU AI Act Compliance Audit"
4. **Causal Graph** erscheint — 5 Agents mit Tokens + Kosten, verbunden durch Edges
5. **Klickt einen Node** — Sidebar zeigt Agent-Details, Decision Reasoning, Model
6. **Sieht Compliance Score** — Ring zeigt 87/100 (HIGH), Checks-Breakdown darunter
7. **Klickt "Download PDF"** — erhält einen formalen Compliance Report
8. **Schaltet auf Live** (Blue Toggle) — sieht "Connect your agents" oder vorhandene Traces
9. **Klickt "Run Demo Simulation"** — 5 frische Pipelines erscheinen (lokal, keine API)
10. **Jeder Run ist anders** — Jitter auf Tokens, Kosten, Scores
11. **Kann unbegrenzt oft klicken** — neue UUIDs jedes Mal
12. **Liest Docs** — sieht `pip install aeneas-agentwatch`, Quickstart in 2 Minuten
13. **Sieht Pricing** — Open Source (Free) / Pro (Coming Soon) / Enterprise (Contact)
14. **Sieht Investors Page** — Market $6.8B, EU AI Act Deadline Dec 2027

**Kein Login nötig. Kein Setup. Funktioniert auf jedem Gerät mit Browser.**

**Mehrere Investoren gleichzeitig:** Jeder sieht seine eigene Simulation (client-seitig). Demo-Modus + Simulation-Button brauchen keinen Server — unbegrenzt parallel.
