"""
[PRODUCTNAME] Kafka Pipeline Test
Prüft den vollständigen Proxy → Kafka → Backend Consumer → ClickHouse Pfad.

Usage:
    python tests/test_kafka_pipeline.py
"""
import time
import uuid
import httpx
import urllib.request
import urllib.parse
import json
import sys

PROXY_URL = "http://localhost:8080"
BACKEND_URL = "http://localhost:3001"
CH_URL = "http://localhost:8123"
CH_DB = "productname"

PASS = "  PASS"
FAIL = "  FAIL"


def check(label: str, cond: bool, detail: str = ""):
    status = PASS if cond else FAIL
    print(f"{status}: {label}" + (f" — {detail}" if detail else ""))
    return cond


def ch_count(trace_id: str) -> int:
    """Count rows in ClickHouse for a given trace_id."""
    q = f"SELECT count() AS n FROM agent_spans WHERE trace_id = '{trace_id}' FORMAT JSON"
    url = f"{CH_URL}/?database={CH_DB}&query={urllib.parse.quote(q)}"
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            data = json.loads(r.read())
            return int(data["data"][0]["n"])
    except Exception:
        return -1


def main():
    print(f"\n[PRODUCTNAME] Kafka Pipeline Test")
    print(f"{'=' * 60}")
    passed = 0
    failed = 0

    trace_id = uuid.uuid4().hex
    span_id = uuid.uuid4().hex[:16]

    span = {
        "trace_id": trace_id,
        "span_id": span_id,
        "name": "kafka.pipeline.test",
        "kind": "SERVER",
        "start_time_unix_nano": int(time.time() * 1e9),
        "end_time_unix_nano": int((time.time() + 0.5) * 1e9),
        "status": {"code": "OK"},
        "agent_id": "kafka-test-agent",
        "agent_name": "Kafka Pipeline Tester",
        "agent_role": "Tester",
        "compliance_flags": ["eu_ai_act_art12_relevant"],
        "model_inference": {
            "model_name": "gpt-4o-mini",
            "provider": "OpenAI",
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "latency_ms": 100,
        },
        "cost_attribution": {"task_id": f"kafka-test-{trace_id[:8]}"},
    }

    # 1. Send via proxy /ingest (goes to Kafka)
    print(f"\n[1] Proxy → Kafka ingestion")
    try:
        r = httpx.post(f"{PROXY_URL}/ingest", json=span, timeout=5)
        if check("Proxy /ingest accepted (202)", r.status_code == 202): passed += 1
        else: failed += 1; print(f"    Got: {r.status_code} {r.text}")
    except Exception as e:
        check("Proxy /ingest", False, str(e)); failed += 1

    # 2. Wait for Kafka consumer to process and write to ClickHouse
    print(f"\n[2] Kafka Consumer → ClickHouse (waiting up to 15s)")
    found = False
    for attempt in range(15):
        time.sleep(1)
        n = ch_count(trace_id)
        if n > 0:
            found = True
            if check(f"Span arrived in ClickHouse after {attempt+1}s", True, f"{n} row(s)"): passed += 1
            break
        print(f"    [{attempt+1}s] waiting...", end="\r")

    if not found:
        check("Span arrived in ClickHouse", False, "timeout after 15s — Kafka consumer may not be running")
        failed += 1

    # 3. Verify via REST API
    print(f"\n[3] REST API sees the Kafka-ingested span")
    try:
        r = httpx.get(f"{BACKEND_URL}/api/traces/{trace_id}/graph", timeout=10)
        data = r.json()
        nodes = data.get("nodes", [])
        if check("Graph API returns span from Kafka", len(nodes) == 1, f"{len(nodes)} node(s)"): passed += 1
        else: failed += 1
    except Exception as e:
        check("Graph API", False, str(e)); failed += 1

    # Summary
    total = passed + failed
    print(f"\n{'=' * 60}")
    print(f"Results: {passed}/{total} passed, {failed} failed")
    print()
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
