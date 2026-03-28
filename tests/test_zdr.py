"""
[PRODUCTNAME] Integration Test — Zero Data Retention (ZDR)
Prüft ob sensitive Daten korrekt gestripped werden.

Voraussetzung: Backend läuft mit ZERO_DATA_RETENTION=true

Usage:
    ZERO_DATA_RETENTION=true npm run dev --workspace=backend
    python tests/test_zdr.py
"""
import uuid
import time
import httpx
import json
import argparse

DEFAULT_INGEST_URL = "http://localhost:3001/api/ingest"
DEFAULT_CH_URL = "http://localhost:8123"
DEFAULT_DB = "[productname]"

SENSITIVE_INPUT = "TOP SECRET: My credit card is 4111-1111-1111-1111"
SENSITIVE_OUTPUT = "CLASSIFIED: The password is hunter2"


def ch_query(ch_url: str, db: str, sql: str) -> list:
    try:
        r = httpx.post(ch_url, content=sql, params={"database": db}, timeout=10)
        return r.json().get("data", [])
    except Exception:
        return []


def main():
    parser = argparse.ArgumentParser(description="[PRODUCTNAME] ZDR Test")
    parser.add_argument("--ingest", default=DEFAULT_INGEST_URL)
    parser.add_argument("--ch-url", default=DEFAULT_CH_URL)
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--zdr", action="store_true", help="Expect ZDR to be active (strip input/output)")
    args = parser.parse_args()

    trace_id = uuid.uuid4().hex
    span_id = uuid.uuid4().hex[:16]
    span_name = f"zdr.test.{uuid.uuid4().hex[:8]}"

    print(f"\n[PRODUCTNAME] Zero Data Retention Test")
    print(f"{'=' * 50}")
    print(f"  Mode:     {'ZDR active (expect stripped data)' if args.zdr else 'Normal (expect data stored)'}")
    print(f"  Trace ID: {trace_id}")
    print(f"  Span:     {span_name}")
    print()

    # Send span with sensitive data
    span = {
        "trace_id": trace_id,
        "span_id": span_id,
        "name": span_name,
        "kind": "CLIENT",
        "start_time_unix_nano": int(time.time() * 1e9),
        "end_time_unix_nano": int((time.time() + 1.0) * 1e9),
        "status": {"code": "OK"},
        "agent_id": "zdr-test-agent",
        "agent_name": "ZDR-Test",
        "agent_role": "SecurityTester",
        "input": SENSITIVE_INPUT,
        "output": SENSITIVE_OUTPUT,
        "decision_reasoning": "SENSITIVE: internal reasoning",
        "model_inference": {
            "model_name": "gpt-4o-mini",
            "provider": "OpenAI",
            "prompt_tokens": 50,
            "completion_tokens": 25,
            "latency_ms": 100,
        },
    }

    print(f"Sending span with sensitive input/output...")
    r = httpx.post(args.ingest, json=span, timeout=5)
    print(f"  Response: {r.status_code} {r.text[:50]}")

    if r.status_code != 202:
        print("  ERROR: Span not accepted!")
        return

    # Wait for ClickHouse write
    time.sleep(2)
    print(f"\nQuerying ClickHouse for span...")

    rows = ch_query(
        args.ch_url, args.db,
        f"SELECT input, output, decision_reasoning, raw_span FROM agent_spans WHERE name = '{span_name}' FORMAT JSON"
    )

    if not rows:
        print("  WARNING: Span not found in ClickHouse yet (may need more time or Kafka consumer running)")
        return

    row = rows[0]
    print(f"  input:              {repr(row.get('input', 'N/A'))}")
    print(f"  output:             {repr(row.get('output', 'N/A'))}")
    print(f"  decision_reasoning: {repr(row.get('decision_reasoning', 'N/A'))}")

    print()
    if args.zdr:
        # Expect data to be stripped
        ok = True
        if row.get("input") and row["input"] != "\\N":
            print(f"  FAIL: input was stored despite ZDR! Got: {row['input'][:50]}")
            ok = False
        else:
            print(f"  PASS: input is NULL/empty (correctly stripped)")

        if row.get("output") and row["output"] != "\\N":
            print(f"  FAIL: output was stored despite ZDR! Got: {row['output'][:50]}")
            ok = False
        else:
            print(f"  PASS: output is NULL/empty (correctly stripped)")

        # raw_span should also not contain sensitive data
        raw = row.get("raw_span", "")
        if SENSITIVE_INPUT in raw:
            print(f"  FAIL: Sensitive input found in raw_span!")
            ok = False
        else:
            print(f"  PASS: raw_span does not contain sensitive input")

        print(f"\n{'PASS: ZDR working correctly' if ok else 'FAIL: ZDR not working!'}")
    else:
        # Expect data to be present
        ok = True
        if not row.get("input") or row["input"] == "\\N":
            print(f"  FAIL: input is NULL but ZDR is not active!")
            ok = False
        elif SENSITIVE_INPUT in row["input"]:
            print(f"  PASS: input stored correctly")
        else:
            print(f"  WARN: input stored but content differs")

        print(f"\n{'PASS: Normal mode working correctly' if ok else 'FAIL: Data unexpectedly stripped!'}")


if __name__ == "__main__":
    main()
