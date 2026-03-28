# Agent Trace Protocol (ATP) Schema

[![npm version](https://badge.fury.io/js/%40productname%2Fatp-schema.svg)](https://www.npmjs.com/package/@productname/atp-schema)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The **Agent Trace Protocol (ATP)** is an open NDJSON-based telemetry standard for multi-agent AI systems. Think OpenTelemetry, but designed for the specific needs of AI agents: causal reasoning chains, model inference metadata, cost attribution, and EU AI Act compliance flags.

This package provides the canonical [Zod](https://zod.dev) schema for validating ATP spans.

---

## Installation

```bash
npm install @productname/atp-schema zod
```

```bash
pip install atp-schema  # Python (coming soon)
```

---

## Usage

```typescript
import { ATPSpanSchema, type ATPSpan } from '@productname/atp-schema';

const result = ATPSpanSchema.safeParse({
  trace_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  span_id: 'a1b2c3d4e5f6a1b2',
  name: 'agent.plan',
  kind: 'INTERNAL',
  start_time_unix_nano: Date.now() * 1_000_000,
  end_time_unix_nano: (Date.now() + 500) * 1_000_000,
  status: { code: 'OK' },
  agent_id: 'planner-01',
  agent_name: 'PlannerAgent',
  agent_role: 'Orchestrator',
  model_inference: {
    model_name: 'claude-sonnet-4-6',
    provider: 'Anthropic',
    prompt_tokens: 512,
    completion_tokens: 128,
    latency_ms: 487,
  },
  cost_attribution: {
    task_id: 'task-abc123',
    accumulated_cost_usd: 0.0024,
  },
  compliance_flags: ['eu_ai_act_art12_relevant'],
});

if (result.success) {
  const span: ATPSpan = result.data;
  console.log('Valid ATP span:', span.trace_id);
}
```

---

## Schema Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `trace_id` | `string` (hex32) | Groups all spans of one agent run |
| `span_id` | `string` (hex16) | Unique ID for this span |
| `parent_span_id` | `string \| null` (hex16) | Parent span; null for root spans |
| `name` | `string` | Human-readable operation name |
| `kind` | `INTERNAL \| SERVER \| CLIENT \| PRODUCER \| CONSUMER` | Span kind |
| `start_time_unix_nano` | `number` | Start timestamp in nanoseconds |
| `end_time_unix_nano` | `number` | End timestamp in nanoseconds |
| `status` | `{ code: 'UNSET' \| 'OK' \| 'ERROR', message?: string }` | Outcome |
| `agent_id` | `string` | Unique agent instance identifier |
| `agent_name` | `string` | Human-readable agent name |
| `agent_role` | `string` | Role in the multi-agent system |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `decision_reasoning` | `string` | Why the agent made this decision (Chain-of-Thought) |
| `input` | `string` | Input to this span (prompt, query, etc.) |
| `output` | `string` | Output of this span |
| `tool_calls` | `ToolCall[]` | Tool/function calls made during this span |
| `model_inference` | `ModelInference` | LLM call metadata (model, tokens, latency) |
| `cost_attribution` | `CostAttribution` | Task cost tracking |
| `compliance_flags` | `string[]` | e.g. `["eu_ai_act_art12_relevant"]` |
| `links` | `Link[]` | Causal links to other spans |
| `events` | `Event[]` | Timestamped events within the span |
| `attributes` | `Record<string, any>` | Custom metadata |

### Link Types

Causal links between spans express agent dependencies:

```
FOLLOWS_FROM | CAUSES | RELATED_TO | RETRY_OF | RESPONSE_TO | DELEGATES_TO | REQUIRES | CONSENSUS_FOR
```

### Compliance Flags

Mark spans relevant for regulatory requirements:

```
eu_ai_act_art12_relevant   — Article 12: record-keeping for high-risk AI
eu_ai_act_art13_relevant   — Article 13: transparency obligations
```

---

## NDJSON Wire Format

ATP traces are transported as newline-delimited JSON (one span per line):

```ndjson
{"trace_id":"a1b2...","span_id":"c3d4...","name":"orchestrator.plan","kind":"SERVER",...}
{"trace_id":"a1b2...","span_id":"e5f6...","parent_span_id":"c3d4...","name":"researcher.search",...}
{"trace_id":"a1b2...","span_id":"a7b8...","parent_span_id":"c3d4...","name":"analyst.summarize",...}
```

---

## Exports

```typescript
import {
  ATPSpanSchema,        // Main span validator
  StatusSchema,
  ToolCallSchema,
  ModelInferenceSchema,
  CostAttributionSchema,
  LinkSchema,
  EventSchema,
} from '@productname/atp-schema';

import type {
  ATPSpan,
  Status,
  ToolCall,
  ModelInference,
  CostAttribution,
  Link,
  Event,
} from '@productname/atp-schema';
```

---

## License

MIT — see [LICENSE](./LICENSE)

---

## Part of [PRODUCTNAME]

This schema is the open-source core of [PRODUCTNAME], an Agent Observability platform.
The full platform adds: hosted ingestion, causal graph visualization, cost dashboards, and EU AI Act compliance reporting.
