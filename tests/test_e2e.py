"""
AeneasSoft End-to-End Integration Test
Testet den kompletten Datenfluss: Ingest → ClickHouse → API → Graph

Voraussetzung: docker compose up -d (alle Services healthy)

Usage:
    python tests/test_e2e.py
"""
import uuid
import time
import httpx
import sys

BACKEND_URL = "http://localhost:3001"
PROXY_URL = "http://localhost:8080"
CH_URL = "http://localhost:8123"
DB = "productname"

PASS = "  PASS"
FAIL = "  FAIL"


def check(label: str, cond: bool, detail: str = ""):
    status = PASS if cond else FAIL
    print(f"{status}: {label}" + (f" — {detail}" if detail else ""))
    return cond


def main():
    print(f"\nAeneasSoft End-to-End Integration Test")
    print(f"{'=' * 60}")
    passed = 0
    failed = 0

    # ────────────────────────────────────────────────────────
    # 1. Health Checks
    # ────────────────────────────────────────────────────────
    print(f"\n[1] Health Checks")

    try:
        r = httpx.get(f"{BACKEND_URL}/health", timeout=5)
        ok = r.status_code == 200 and r.json().get("status") == "ok"
        if check("Backend /health", ok): passed += 1
        else: failed += 1
    except Exception as e:
        check("Backend /health", False, str(e)); failed += 1

    try:
        r = httpx.get(f"{PROXY_URL}/health", timeout=5)
        ok = r.status_code == 200 and r.json().get("status") == "ok"
        if check("Proxy /health", ok): passed += 1
        else: failed += 1
    except Exception as e:
        check("Proxy /health", False, str(e)); failed += 1

    try:
        r = httpx.get(f"{CH_URL}/ping", timeout=5)
        if check("ClickHouse /ping", r.status_code == 200): passed += 1
        else: failed += 1
    except Exception as e:
        check("ClickHouse /ping", False, str(e)); failed += 1

    # ────────────────────────────────────────────────────────
    # 2. Span Ingestion
    # ────────────────────────────────────────────────────────
    print(f"\n[2] Span Ingestion")
    trace_id = uuid.uuid4().hex
    root_span_id = uuid.uuid4().hex[:16]
    child_span_id = uuid.uuid4().hex[:16]
    span_name = f"e2e.test.{uuid.uuid4().hex[:6]}"

    root_span = {
        "trace_id": trace_id,
        "span_id": root_span_id,
        "name": f"{span_name}.root",
        "kind": "SERVER",
        "start_time_unix_nano": int(time.time() * 1e9),
        "end_time_unix_nano": int((time.time() + 1.0) * 1e9),
        "status": {"code": "OK"},
        "agent_id": "e2e-orch",
        "agent_name": "E2E Orchestrator",
        "agent_role": "Orchestrator",
        "decision_reasoning": "E2E test run",
        "compliance_flags": ["eu_ai_act_art12_relevant"],
        "model_inference": {
            "model_name": "claude-sonnet-4-6",
            "provider": "Anthropic",
            "prompt_tokens": 200,
            "completion_tokens": 100,
            "latency_ms": 1000,
        },
        "cost_attribution": {"task_id": f"e2e-{trace_id[:8]}", "accumulated_cost_usd": 0.002},
    }

    child_span = {
        "trace_id": trace_id,
        "span_id": child_span_id,
        "parent_span_id": root_span_id,
        "name": f"{span_name}.child",
        "kind": "INTERNAL",
        "start_time_unix_nano": int(time.time() * 1e9),
        "end_time_unix_nano": int((time.time() + 0.5) * 1e9),
        "status": {"code": "ERROR", "message": "Intentional E2E error"},
        "agent_id": "e2e-worker",
        "agent_name": "E2E Worker",
        "agent_role": "Worker",
        "model_inference": {
            "model_name": "gpt-4o-mini",
            "provider": "OpenAI",
            "prompt_tokens": 50,
            "completion_tokens": 25,
            "latency_ms": 500,
        },
        "cost_attribution": {"task_id": f"e2e-{trace_id[:8]}", "accumulated_cost_usd": 0.0001},
    }

    for span in [root_span, child_span]:
        try:
            r = httpx.post(f"{BACKEND_URL}/api/ingest", json=span, timeout=5)
            if check(f"Ingest span '{span['name'].split('.')[-1]}'", r.status_code == 202):
                passed += 1
            else:
                failed += 1
                print(f"    Response: {r.status_code} {r.text[:100]}")
        except Exception as e:
            check(f"Ingest span", False, str(e)); failed += 1

    # ────────────────────────────────────────────────────────
    # 3. API Endpoints
    # ────────────────────────────────────────────────────────
    print(f"\n[3] API Endpoints")

    try:
        r = httpx.get(f"{BACKEND_URL}/api/traces", timeout=10)
        ok = r.status_code == 200 and "traces" in r.json()
        if check("/api/traces returns JSON", ok, f"{len(r.json().get('traces', []))} traces"): passed += 1
        else: failed += 1
    except Exception as e:
        check("/api/traces", False, str(e)); failed += 1

    try:
        r = httpx.get(f"{BACKEND_URL}/api/metrics", timeout=10)
        data = r.json()
        ok = r.status_code == 200 and "total_traces" in data and "period" in data
        if check("/api/metrics returns KPIs", ok, f"total={data.get('total_traces', '?')}"): passed += 1
        else: failed += 1
    except Exception as e:
        check("/api/metrics", False, str(e)); failed += 1

    # ────────────────────────────────────────────────────────
    # 4. Graph API (may need to wait for ClickHouse write)
    # ────────────────────────────────────────────────────────
    print(f"\n[4] Graph API (waits up to 5s for ClickHouse write)")
    time.sleep(3)

    try:
        r = httpx.get(f"{BACKEND_URL}/api/traces/{trace_id}/graph", timeout=10)
        data = r.json()
        nodes = data.get("nodes", [])
        edges = data.get("edges", [])
        ok_nodes = check("Graph has 2 nodes", len(nodes) == 2, f"got {len(nodes)}")
        ok_edges = check("Graph has 1 edge",  len(edges) == 1, f"got {len(edges)}")
        if ok_nodes: passed += 1
        else: failed += 1
        if ok_edges: passed += 1
        else: failed += 1

        # Cost check
        cost = data.get("totalCost", 0)
        if check("Graph has calculated cost", cost > 0, f"${cost:.6f}"): passed += 1
        else: failed += 1
    except Exception as e:
        check("Graph API", False, str(e)); failed += 1
        failed += 2  # nodes + edges checks

    # ────────────────────────────────────────────────────────
    # 5. Compliance Report (PDF)
    # ────────────────────────────────────────────────────────
    print(f"\n[5] Compliance PDF Export")
    try:
        r = httpx.get(f"{BACKEND_URL}/api/traces/{trace_id}/compliance-report", timeout=15)
        is_pdf = r.headers.get("content-type", "").startswith("application/pdf")
        has_content = len(r.content) > 1000
        if check("PDF generated", r.status_code == 200 and is_pdf and has_content,
                  f"{len(r.content)} bytes"): passed += 1
        else: failed += 1
    except Exception as e:
        check("PDF export", False, str(e)); failed += 1

    # ────────────────────────────────────────────────────────
    # 6. Schema validation via proxy /ingest
    # ────────────────────────────────────────────────────────
    print(f"\n[6] Proxy Ingest")
    try:
        r = httpx.post(f"{PROXY_URL}/ingest", json=root_span, timeout=5)
        if check("Proxy /ingest accepts span", r.status_code == 202): passed += 1
        else: failed += 1
    except Exception as e:
        check("Proxy /ingest", False, str(e)); failed += 1

    # ────────────────────────────────────────────────────────
    # Summary
    # ────────────────────────────────────────────────────────
    total = passed + failed
    print(f"\n{'=' * 60}")
    print(f"Results: {passed}/{total} passed, {failed} failed")
    print(f"Trace:   http://localhost:3000/traces/{trace_id}")
    print()

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
