"""
[PRODUCTNAME] Demo — Simulated Multi-Agent Workflow
Generates immediately visible traces in the dashboard.

Usage:
    python demo/run.py
"""
import uuid
import time
import json
import httpx

INGEST_URL = "http://localhost:3001/api/ingest"
TRACE_ID   = uuid.uuid4().hex          # 32-char hex trace ID
SPAN_ORCH  = uuid.uuid4().hex[:16]     # 16-char hex span IDs
SPAN_RES   = uuid.uuid4().hex[:16]
SPAN_ANA   = uuid.uuid4().hex[:16]
SPAN_ERR   = uuid.uuid4().hex[:16]


def send_span(span: dict):
    try:
        resp = httpx.post(INGEST_URL, json=span, timeout=5)
        if resp.status_code < 300:
            print(f"  Span sent: {span['name']}")
        else:
            print(f"  Error ({resp.status_code}): {resp.text[:100]}")
    except Exception as e:
        print(f"  Connection error: {e}")


print(f"\n[PRODUCTNAME] Demo — Multi-Agent Workflow")
print(f"{'=' * 50}")
print(f"Trace ID: {TRACE_ID}")
print(f"Ingest URL: {INGEST_URL}\n")

# 1. Orchestrator Span (root)
print("[1/4] Sending Orchestrator span...")
send_span({
    "trace_id": TRACE_ID,
    "span_id": SPAN_ORCH,
    "name": "orchestrator.plan_task",
    "kind": "SERVER",
    "start_time_unix_nano": int(time.time() * 1e9),
    "end_time_unix_nano": int((time.time() + 1.5) * 1e9),
    "status": {"code": "OK"},
    "agent_id": "orch-01",
    "agent_name": "MainOrchestrator",
    "agent_role": "Orchestrator",
    "decision_reasoning": "Task requires research and analysis, delegating to sub-agents",
    "compliance_flags": ["eu_ai_act_art12_relevant"],
    "model_inference": {
        "model_name": "claude-sonnet-4-6",
        "provider": "Anthropic",
        "prompt_tokens": 500,
        "completion_tokens": 150,
        "latency_ms": 1500,
    },
    "cost_attribution": {
        "task_id": f"demo-{TRACE_ID[:8]}",
        "accumulated_cost_usd": 0.004,
    },
})

time.sleep(0.2)

# 2. Research Sub-Agent
print("[2/4] Sending Research Agent span...")
send_span({
    "trace_id": TRACE_ID,
    "span_id": SPAN_RES,
    "parent_span_id": SPAN_ORCH,
    "name": "researcher.web_search",
    "kind": "INTERNAL",
    "start_time_unix_nano": int(time.time() * 1e9),
    "end_time_unix_nano": int((time.time() + 2.0) * 1e9),
    "status": {"code": "OK"},
    "agent_id": "res-01",
    "agent_name": "ResearcherBot",
    "agent_role": "Researcher",
    "input": "Search for recent AI regulation updates in EU",
    "output": "Found 15 relevant articles about EU AI Act implementation deadlines",
    "model_inference": {
        "model_name": "gpt-4o-mini",
        "provider": "OpenAI",
        "prompt_tokens": 200,
        "completion_tokens": 800,
        "latency_ms": 2000,
    },
    "cost_attribution": {
        "task_id": f"demo-{TRACE_ID[:8]}",
        "accumulated_cost_usd": 0.0005,
    },
})

time.sleep(0.2)

# 3. Analysis Sub-Agent (with causal link to research)
print("[3/4] Sending Analysis Agent span...")
send_span({
    "trace_id": TRACE_ID,
    "span_id": SPAN_ANA,
    "parent_span_id": SPAN_ORCH,
    "name": "analyst.process_results",
    "kind": "INTERNAL",
    "start_time_unix_nano": int(time.time() * 1e9),
    "end_time_unix_nano": int((time.time() + 3.0) * 1e9),
    "status": {"code": "OK"},
    "agent_id": "ana-01",
    "agent_name": "AnalystBot",
    "agent_role": "Analyst",
    "decision_reasoning": "Processing research results to generate compliance summary",
    "compliance_flags": ["eu_ai_act_art12_relevant"],
    "links": [
        {
            "trace_id": TRACE_ID,
            "span_id": SPAN_RES,
            "link_type": "REQUIRES",
        }
    ],
    "model_inference": {
        "model_name": "claude-sonnet-4-6",
        "provider": "Anthropic",
        "prompt_tokens": 1200,
        "completion_tokens": 400,
        "latency_ms": 3000,
    },
    "cost_attribution": {
        "task_id": f"demo-{TRACE_ID[:8]}",
        "accumulated_cost_usd": 0.0072,
    },
})

time.sleep(0.2)

# 4. Error span (to test error display)
print("[4/4] Sending Error span (simulated failure)...")
send_span({
    "trace_id": TRACE_ID,
    "span_id": SPAN_ERR,
    "parent_span_id": SPAN_ORCH,
    "name": "validator.check_output",
    "kind": "INTERNAL",
    "start_time_unix_nano": int(time.time() * 1e9),
    "end_time_unix_nano": int((time.time() + 0.5) * 1e9),
    "status": {"code": "ERROR", "message": "Output validation failed: missing required field 'summary'"},
    "agent_id": "val-01",
    "agent_name": "ValidatorBot",
    "agent_role": "Validator",
    "model_inference": {
        "model_name": "gpt-4o-mini",
        "provider": "OpenAI",
        "prompt_tokens": 100,
        "completion_tokens": 50,
        "latency_ms": 500,
    },
    "cost_attribution": {
        "task_id": f"demo-{TRACE_ID[:8]}",
        "accumulated_cost_usd": 0.0001,
    },
})

print(f"\nDemo complete!")
print(f"Trace ID: {TRACE_ID}")
print(f"Open: http://localhost:3000/traces/{TRACE_ID}")
print(f"API:  http://localhost:3001/api/traces/{TRACE_ID}/graph")
