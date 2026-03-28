# CLAUDE.md — Projektkontext für [PRODUCTNAME]

## Was dieses Projekt ist
Ein Agent Observability Tool: Es beobachtet, debuggt und auditiert Multi-Agenten-KI-Systeme.
Herzstück ist das Agent Trace Protocol (ATP) — ein offener NDJSON-basierter Telemetrie-Standard.

---

## KRITISCHE REGEL: Produktname
Der Produktname ist überall im Code als `[PRODUCTNAME]` geschrieben (inkl. eckiger Klammern).
NIEMALS einen echten Namen hardcoden. Dieser Platzhalter wird später global ersetzt.
Gilt für: Dateinamen, Kommentare, Strings, Umgebungsvariablen, Docker-Labels, README.

---

## Tech Stack
- **Proxy:** Fastify (Node.js/TypeScript), Port 8080
- **Backend API:** Fastify (Node.js/TypeScript), Port 3001
- **Frontend:** Next.js 14 (App Router) + TailwindCSS + React Flow, Port 3000
- **SDK Python:** Pydantic + monkey-patching
- **SDK Node.js:** TypeScript + prototype-patching
- **Queue:** Kafka (bitnami/kafka:3.4, KRaft-Modus, kein Zookeeper)
- **Trace-DB:** ClickHouse 23.8
- **Meta-DB:** PostgreSQL 15 + Prisma ORM
- **Package-Manager:** npm workspaces (Turborepo-kompatibel)
- **Testing:** Vitest (TypeScript), pytest (Python)

---

## Projektstruktur
```
[productname]-mvp/          <- Root (KEIN Leerzeichen im Pfad!)
├── CLAUDE.md               <- Diese Datei
├── package.json            <- npm workspace root
├── docker-compose.yml
├── .claude/settings.json   <- bypassPermissions
├── .env.example
├── LICENSE                 <- MIT
├── README.md
├── packages/
│   └── atp-schema/         <- Zod-Schema (shared)
│       ├── package.json
│       └── src/
│           ├── schema.ts
│           └── index.ts
├── proxy/                  <- API Proxy (Fastify)
│   ├── package.json
│   └── src/
│       ├── index.ts
│       ├── proxy.ts
│       └── kafka-producer.ts
├── sdks/
│   ├── python/             <- agentwatch Python SDK
│   │   ├── pyproject.toml
│   │   └── agentwatch/
│   │       ├── __init__.py
│   │       ├── schema.py
│   │       ├── patcher.py
│   │       └── exporter.py
│   └── node/               <- agentwatch Node SDK
│       ├── package.json
│       └── src/
│           ├── index.ts
│           └── patcher.ts
├── backend/                <- Backend API
│   ├── package.json
│   ├── prisma/schema.prisma
│   └── src/
│       ├── index.ts
│       ├── api/routes.ts
│       ├── engine/
│       │   ├── causal-graph.ts
│       │   └── cost-attribution.ts
│       ├── compliance/exporter.ts
│       └── db/
│           ├── clickhouse.ts
│           └── postgres.ts
├── frontend/               <- Next.js Dashboard
│   ├── package.json
│   ├── next.config.js
│   └── src/
│       ├── app/
│       │   ├── page.tsx
│       │   └── traces/[id]/page.tsx
│       └── components/
│           ├── TraceList.tsx
│           ├── CausalGraph.tsx
│           └── MetricsCards.tsx
├── legal/
│   ├── DPA_TEMPLATE.md     <- DSGVO Data Processing Agreement
│   └── TERMS_OF_SERVICE.md
└── demo/
    └── run.py              <- Demo-Script
```

---

## ATP Schema — Pflichtfelder eines Spans
```typescript
{
  trace_id: string,        // hex32
  span_id: string,         // hex16
  parent_span_id?: string, // hex16
  name: string,
  kind: 'INTERNAL'|'SERVER'|'CLIENT'|'PRODUCER'|'CONSUMER',
  start_time_unix_nano: number,
  end_time_unix_nano: number,
  status: { code: 'UNSET'|'OK'|'ERROR', message?: string },
  agent_id: string,
  agent_name: string,
  agent_role: string,
  decision_reasoning?: string,
  input?: string,
  output?: string,
  tool_calls?: ToolCall[],
  model_inference?: ModelInference,
  cost_attribution?: { task_id: string, accumulated_cost_usd?: number },
  compliance_flags?: string[],
  links?: Link[],
  events?: Event[],
  attributes?: Record<string, any>
}
```

---

## DSGVO / Datenschutz — IMMER einhalten
- Zero Data Retention Modus: Wenn `ZERO_DATA_RETENTION=true` -> KEINE Prompts/Outputs speichern, NUR Metadaten (Timestamps, Kosten, Fehlercodes)
- Prüfpflicht: Überall wo sensible Daten geloggt werden könnten -> ZDR-Check einbauen
- Verschlüsselung: Alle Daten at rest + in transit verschlüsseln
- Auto-Löschung: ClickHouse TTL = 30 Tage (konfigurierbar via `DATA_RETENTION_DAYS`)
- API Keys: Niemals im Klartext loggen — immer hashen oder maskieren

---

## Sicherheitsregeln (immer befolgen)
- API Keys: `process.env.UPSTREAM_API_KEY` — niemals hardcoden
- Proxy validiert `X-[PRODUCTNAME]-API-Key` gegen PostgreSQL (mit Redis-Cache)
- SHA-256 Checksummen für Compliance-Reports
- ClickHouse-Passwort aus Umgebungsvariablen

---

## EU AI Act Compliance
- Alle ATP-Spans mit `compliance_flags: ["eu_ai_act_art12_relevant"]` markieren wenn relevant
- ComplianceExporter muss Artikel 12 + 13 abdecken
- Pflicht-Disclaimer im Export: "This report was automatically generated and should be reviewed by a qualified legal professional before submission to authorities"
- SHA-256 Hash am Ende jedes Reports

---

## Open Source Lizenz
- MIT für den Open Source Kern
- LICENSE Datei im Root
- README: klar trennen was Open Source vs. Enterprise ist

---

## Bekannte Fallstricke (von vorherigen Sessions gelernt)
- OpenAI Async Client (`AsyncCompletions`) muss separat gepatcht werden (Python SDK)
- Kafka KRaft-Modus braucht `KAFKA_CFG_PROCESS_ROLES=controller,broker`
- ClickHouse `max_row` in read-only Mode kann `None` sein — nie darauf verlassen
- React Flow: `p.slides[:3]` wirft AttributeError — `islice` verwenden
- Streaming SSE von OpenAI darf der Proxy NICHT puffern
- Zod `regex` für trace_id/span_id: `/^[0-9a-f]{32}$/` bzw. `/^[0-9a-f]{16}$/`
- `--allowedTools` wird mit `bypassPermissions` manchmal ignoriert -> `--disallowedTools` nutzen

---

## Umgebungsvariablen (.env.example)
```
# Proxy
UPSTREAM_OPENAI_URL=https://api.openai.com
UPSTREAM_ANTHROPIC_URL=https://api.anthropic.com
KAFKA_BROKERS=localhost:9092
ZERO_DATA_RETENTION=false
DATA_RETENTION_DAYS=30

# Backend
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DB=[productname]
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/[productname]
PORT=3001

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Testbefehle
```bash
npm run test --workspace=packages/atp-schema   # Schema Tests
npm run test --workspace=proxy                  # Proxy Tests
npm run test --workspace=backend               # Backend Tests
pytest sdks/python/tests                       # Python SDK Tests
docker compose up -d                           # Alle Services starten
python demo/run.py                             # Demo-Script
```
