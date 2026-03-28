# [PRODUCTNAME]

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

**[PRODUCTNAME]** is an Agent Observability platform that monitors, debugs, and audits multi-agent AI systems. It uses the Agent Trace Protocol (ATP) — an open NDJSON-based telemetry standard designed specifically for AI agent workflows.

---

## Quickstart

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

That's it.

### Windows

```cmd
git clone <repo-url>
cd [productname]-mvp
setup.bat
```

### Mac / Linux

```bash
git clone <repo-url>
cd [productname]-mvp
chmod +x setup.sh && ./setup.sh
```

The setup script will:
1. Check that Docker is running
2. Create `.env` automatically
3. Build and start all services
4. Wait until everything is healthy
5. Run the demo and open the dashboard

### View the Dashboard

Open [http://localhost:3000](http://localhost:3000) to see:
- **KPI Cards** — Total traces, error rate, cost, latency
- **Trace List** — Click any trace to view the causal graph
- **Causal Graph** — Interactive visualization with dagre layout
- **EU AI Act Report** — Download compliance PDF for any trace

---

## USB-Stick Integration

### Python SDK (2 lines)

```python
import agentwatch
agentwatch.init(api_key="your-key")

# That's it! All OpenAI and Anthropic calls are now traced.
```

### Node.js SDK (coming soon)

```typescript
import { init } from '@productname/sdk-node';
init({ apiKey: 'your-key' });
```

---

## Architecture

```
Your App  -->  [PRODUCTNAME] Proxy (8080)  -->  OpenAI / Anthropic
                    |
                    v
                Kafka (agent-traces topic)
                    |
                    v
              Backend API (3001)  -->  ClickHouse (traces)
                    |                  PostgreSQL (metadata)
                    v
              Next.js Dashboard (3000)
```

---

## Open Source vs Enterprise

| Feature | Open Source (MIT) | Enterprise |
|---|:---:|:---:|
| ATP Schema & Protocol | x | x |
| API Proxy (OpenAI + Anthropic) | x | x |
| Python & Node.js SDKs | x | x |
| Causal Graph Visualization | x | x |
| EU AI Act Compliance Export | x | x |
| Cost Attribution Engine | x | x |
| Self-Hosted Deployment | x | x |
| Managed Cloud Hosting | | x |
| Priority Support & SLA | | x |
| Advanced Alerting | | x |
| RBAC & SSO | | x |
| Multi-Tenant Isolation | | x |

---

## Key Features

### Agent Trace Protocol (ATP)
Open NDJSON-based telemetry standard with:
- Parent-child span relationships
- Causal links (REQUIRES, FOLLOWS_FROM, DELEGATES_TO, etc.)
- Model inference metadata (tokens, cost, latency)
- EU AI Act compliance flags
- Zero Data Retention mode for GDPR compliance

### Causal Graph Engine
- DAG reconstruction from out-of-order spans
- Orphan buffer with 5-second timeout
- React Flow visualization with dagre layout
- Multi-parent edge support (causal links as dashed arrows)

### Cost Attribution
- Per-span cost calculation using published pricing
- Breakdown by agent, model, and task
- Support for GPT-4o, Claude Sonnet/Opus, and more

### EU AI Act Compliance
- Automatic PDF report generation
- Article 12 (event logging) and Article 13 (transparency) coverage
- SHA-256 integrity hash for audit trail
- Legal disclaimer included

---

## Development

```bash
# Install dependencies
npm install

# Run all tests
npm run test --workspaces --if-present
python -m pytest sdks/python/tests

# Start in dev mode (requires Docker services running)
docker compose up -d
npm run dev
```

---

## Tech Stack

| Component | Technology |
|---|---|
| Proxy | Fastify (TypeScript) |
| Backend API | Fastify (TypeScript) |
| Frontend | Next.js 14 + TailwindCSS + React Flow |
| Python SDK | Pydantic + monkey-patching |
| Queue | Kafka (KRaft mode) |
| Trace DB | ClickHouse 23.8 |
| Meta DB | PostgreSQL 15 + Prisma |

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
