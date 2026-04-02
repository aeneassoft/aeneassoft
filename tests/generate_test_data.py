"""AeneasSoft — Test Data Generator. Sends realistic + stress traces."""
import httpx
import asyncio
import uuid
import time
import random
import argparse

API_URL = "https://api.aeneassoft.com"

AGENTS = [
    {"id": "research-agent-01", "name": "ResearchBot", "role": "Researcher", "model": "gpt-4o"},
    {"id": "writer-agent-01", "name": "WriterBot", "role": "Writer", "model": "claude-3-5-sonnet-20241022"},
    {"id": "analyst-agent-01", "name": "AnalystBot", "role": "Analyst", "model": "gpt-4o-mini"},
    {"id": "orchestrator-01", "name": "OrchestratorBot", "role": "Orchestrator", "model": "gpt-4o"},
    {"id": "compliance-agent-01", "name": "ComplianceBot", "role": "Compliance Checker", "model": "claude-3-5-haiku-20241022"},
    {"id": "expensive-agent-01", "name": "ExpensiveResearch", "role": "Senior Researcher", "model": "gpt-4o"},
    {"id": "buggy-agent-01", "name": "BuggyAgent", "role": "Unstable Worker", "model": "gpt-4o-mini"},
    {"id": "fast-agent-01", "name": "FastAgent", "role": "Speed Optimizer", "model": "gpt-4o-mini"},
    {"id": "slow-agent-01", "name": "SlowAgent", "role": "Deep Analyzer", "model": "gpt-4o"},
    {"id": "token-heavy-01", "name": "TokenHeavyAgent", "role": "Document Processor", "model": "claude-3-5-sonnet-20241022"},
]

PIPELINES = [
    "EU AI Act Compliance Audit", "Customer Support Analysis", "Market Research Pipeline",
    "Code Review Automation", "Document Processing", "Sales Email Generation",
    "Financial Report Analysis", "Legal Document Review", "Risk Assessment Pipeline",
    "Data Migration Validator", "Contract Analyzer", "Fraud Detection Scan",
]

MODEL_COSTS = {
    "gpt-4o": {"prompt": 0.005, "completion": 0.015},
    "gpt-4o-mini": {"prompt": 0.00015, "completion": 0.0006},
    "claude-3-5-sonnet-20241022": {"prompt": 0.003, "completion": 0.015},
    "claude-3-5-haiku-20241022": {"prompt": 0.001, "completion": 0.005},
}

STRESS_PROFILES = {
    "expensive-agent-01": {"cost_mult": 10, "error_rate": 0.05},
    "buggy-agent-01": {"cost_mult": 1, "error_rate": 0.6},
    "fast-agent-01": {"cost_mult": 1, "error_rate": 0.02, "latency": (50, 200)},
    "slow-agent-01": {"cost_mult": 1, "error_rate": 0.1, "latency": (10000, 30000)},
    "token-heavy-01": {"cost_mult": 1, "error_rate": 0.05, "token_mult": 5},
}


def generate_span(trace_id, agent, pipeline_name, parent_span_id=None):
    profile = STRESS_PROFILES.get(agent["id"], {})
    token_mult = profile.get("token_mult", 1)
    cost_mult = profile.get("cost_mult", 1)
    error_rate = profile.get("error_rate", 0.08)
    lat_range = profile.get("latency", (500, 5000))

    pt = random.randint(200, 2000) * token_mult
    ct = random.randint(50, 500) * token_mult
    latency = random.randint(*lat_range)
    costs = MODEL_COSTS.get(agent["model"], {"prompt": 0.001, "completion": 0.002})
    cost = ((pt / 1000) * costs["prompt"] + (ct / 1000) * costs["completion"]) * cost_mult
    status = "ERROR" if random.random() < error_rate else "OK"
    error_msgs = ["timeout: upstream error", "rate_limit_exceeded", "context_length_exceeded", "connection_reset", "internal_server_error"]
    now = time.time_ns()

    return {
        "trace_id": trace_id,
        "span_id": uuid.uuid4().hex[:16],
        **({"parent_span_id": parent_span_id} if parent_span_id else {}),
        "name": f"{agent['role'].lower().replace(' ', '_')}.process",
        "kind": "CLIENT",
        "start_time_unix_nano": now,
        "end_time_unix_nano": now + (latency * 1_000_000),
        "status": {"code": status, "message": random.choice(error_msgs) if status == "ERROR" else ""},
        "agent_id": agent["id"],
        "agent_name": agent["name"],
        "agent_role": agent["role"],
        "decision_reasoning": f"Processing as {agent['role']} for {pipeline_name}",
        "compliance_flags": ["eu_ai_act_art12_relevant"],
        "model_inference": {
            "model_name": agent["model"],
            "provider": "OpenAI" if "gpt" in agent["model"] else "Anthropic",
            "prompt_tokens": pt, "completion_tokens": ct, "latency_ms": latency,
        },
        "cost_attribution": {"task_id": f"task-{trace_id[:8]}", "accumulated_cost_usd": cost},
        "input": f"Process the following for {pipeline_name}",
        "output": f"Completed {agent['role']} task successfully" if status == "OK" else f"FAILED: {random.choice(error_msgs)}",
    }


async def send_span(client, api_key, span):
    try:
        r = await client.post(f"{API_URL}/api/ingest", json=span,
            headers={"X-API-Key": api_key}, timeout=10)
        return r.status_code in (200, 202)
    except:
        return False


async def main(api_key, count=500):
    print(f"AeneasSoft Stress Test Data Generator")
    print(f"API: {API_URL}")
    print(f"Key: {api_key[:15]}...")
    print(f"Generating {count} traces...")
    print()

    async with httpx.AsyncClient() as client:
        success = 0
        fail = 0

        for i in range(count):
            pipeline = random.choice(PIPELINES)
            trace_id = uuid.uuid4().hex

            if i % 50 == 0:
                print(f"[{i}/{count}] Progress...")

            # Pick orchestrator
            orch = random.choice([a for a in AGENTS if "orchestrator" in a["id"]])
            orch_span = generate_span(trace_id, orch, pipeline)
            orch_id = orch_span["span_id"]

            if await send_span(client, api_key, orch_span):
                success += 1
            else:
                fail += 1

            # 2-4 sub-agents
            non_orch = [a for a in AGENTS if "orchestrator" not in a["id"]]
            subs = random.sample(non_orch, min(random.randint(2, 4), len(non_orch)))
            for agent in subs:
                span = generate_span(trace_id, agent, pipeline, parent_span_id=orch_id)
                if await send_span(client, api_key, span):
                    success += 1
                else:
                    fail += 1
                await asyncio.sleep(0.02)

            await asyncio.sleep(0.05)

        print(f"\nDone! Sent: {success} OK, {fail} failed")
        print(f"Total spans: {success + fail}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--count", type=int, default=500)
    args = parser.parse_args()
    asyncio.run(main(args.api_key, args.count))
