"""
AeneasSoft Stress Test — Massenhafte Span-Ingestion
Sendet viele Spans parallel und misst Durchsatz.

Usage:
    python tests/stress_ingest.py
    python tests/stress_ingest.py --traces 100 --spans 50 --concurrent 20
"""
import uuid
import time
import httpx
import concurrent.futures
import statistics
import argparse

DEFAULT_INGEST_URL = "http://localhost:3001/api/ingest"
DEFAULT_TRACES = 50
DEFAULT_SPANS_PER_TRACE = 20
DEFAULT_CONCURRENT = 10


def generate_span(trace_id: str, span_id: str, parent_id: str | None = None) -> dict:
    return {
        "trace_id": trace_id,
        "span_id": span_id,
        "parent_span_id": parent_id,
        "name": f"stress.test.op.{uuid.uuid4().hex[:8]}",
        "kind": "INTERNAL",
        "start_time_unix_nano": int(time.time() * 1e9),
        "end_time_unix_nano": int((time.time() + 0.1) * 1e9),
        "status": {"code": "OK"},
        "agent_id": f"stress-{uuid.uuid4().hex[:4]}",
        "agent_name": "StressTestAgent",
        "agent_role": "LoadTester",
        "model_inference": {
            "model_name": "gpt-4o-mini",
            "provider": "OpenAI",
            "prompt_tokens": 100,
            "completion_tokens": 50,
            "latency_ms": 100,
        },
        "cost_attribution": {
            "task_id": f"stress-{trace_id[:8]}",
            "accumulated_cost_usd": 0.0001,
        },
    }


def send_span(url: str, span: dict) -> dict:
    start = time.time()
    try:
        r = httpx.post(url, json=span, timeout=10)
        return {"status": r.status_code, "latency_ms": (time.time() - start) * 1000}
    except Exception as e:
        return {"status": "error", "latency_ms": -1, "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="AeneasSoft Ingest Stress Test")
    parser.add_argument("--url", default=DEFAULT_INGEST_URL)
    parser.add_argument("--traces", type=int, default=DEFAULT_TRACES)
    parser.add_argument("--spans", type=int, default=DEFAULT_SPANS_PER_TRACE)
    parser.add_argument("--concurrent", type=int, default=DEFAULT_CONCURRENT)
    args = parser.parse_args()

    total_spans = args.traces * args.spans
    print(f"\nAeneasSoft Ingest Stress Test")
    print(f"{'=' * 50}")
    print(f"  URL:         {args.url}")
    print(f"  Traces:      {args.traces}")
    print(f"  Spans/trace: {args.spans}")
    print(f"  Total spans: {total_spans}")
    print(f"  Concurrent:  {args.concurrent}")
    print()

    # Generate all spans
    all_spans = []
    for _ in range(args.traces):
        trace_id = uuid.uuid4().hex
        root_id = uuid.uuid4().hex[:16]
        all_spans.append(generate_span(trace_id, root_id))
        for _ in range(args.spans - 1):
            all_spans.append(generate_span(trace_id, uuid.uuid4().hex[:16], root_id))

    print(f"Generated {len(all_spans)} spans. Sending...")
    start = time.time()
    latencies = []
    errors = 0
    statuses: dict[str | int, int] = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrent) as pool:
        futures = [pool.submit(send_span, args.url, span) for span in all_spans]
        for i, f in enumerate(concurrent.futures.as_completed(futures), 1):
            result = f.result()
            status = result["status"]
            statuses[status] = statuses.get(status, 0) + 1
            if result["latency_ms"] > 0:
                latencies.append(result["latency_ms"])
            else:
                errors += 1
            if i % 100 == 0:
                print(f"  Progress: {i}/{len(all_spans)}")

    elapsed = time.time() - start
    latencies.sort()

    print(f"\nResults:")
    print(f"  Total:     {len(all_spans)} spans in {elapsed:.2f}s")
    print(f"  Rate:      {len(all_spans)/elapsed:.0f} spans/sec")
    print(f"  Errors:    {errors}")
    print(f"  Statuses:  {statuses}")
    if latencies:
        print(f"\nLatency (ms):")
        print(f"  min:  {min(latencies):.1f}")
        print(f"  p50:  {statistics.median(latencies):.1f}")
        print(f"  p95:  {latencies[int(len(latencies) * 0.95)]:.1f}")
        print(f"  p99:  {latencies[int(len(latencies) * 0.99)]:.1f}")
        print(f"  max:  {max(latencies):.1f}")

    print(f"\nCheck dashboard: http://localhost:3000")


if __name__ == "__main__":
    main()
