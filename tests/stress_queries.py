"""
[PRODUCTNAME] Stress Test — API Query Performance
Misst Antwortzeiten aller Backend-Endpoints unter Last.

Usage:
    python tests/stress_queries.py
    python tests/stress_queries.py --requests 200 --concurrent 20
"""
import time
import httpx
import concurrent.futures
import statistics
import argparse

DEFAULT_API_URL = "http://localhost:3001"
DEFAULT_REQUESTS = 100
DEFAULT_CONCURRENT = 10


def measure(url: str) -> dict:
    start = time.time()
    try:
        r = httpx.get(url, timeout=15)
        return {
            "status": r.status_code,
            "latency_ms": (time.time() - start) * 1000,
            "ok": r.status_code < 400,
        }
    except Exception as e:
        return {"status": "error", "latency_ms": -1, "ok": False, "error": str(e)}


def stress_endpoint(url: str, n: int, workers: int) -> dict:
    latencies = []
    errors = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(measure, url) for _ in range(n)]
        for f in concurrent.futures.as_completed(futures):
            r = f.result()
            if r["ok"] and r["latency_ms"] > 0:
                latencies.append(r["latency_ms"])
            else:
                errors += 1

    latencies.sort()
    if not latencies:
        return {"errors": errors, "count": n}

    return {
        "count": n,
        "errors": errors,
        "min": min(latencies),
        "p50": statistics.median(latencies),
        "p95": latencies[int(len(latencies) * 0.95)],
        "p99": latencies[int(len(latencies) * 0.99)],
        "max": max(latencies),
        "rps": n / (sum(latencies) / len(latencies) / 1000),
    }


def main():
    parser = argparse.ArgumentParser(description="[PRODUCTNAME] Query Stress Test")
    parser.add_argument("--url", default=DEFAULT_API_URL)
    parser.add_argument("--requests", type=int, default=DEFAULT_REQUESTS)
    parser.add_argument("--concurrent", type=int, default=DEFAULT_CONCURRENT)
    parser.add_argument("--trace-id", help="Specific trace_id for graph/spans tests")
    args = parser.parse_args()

    endpoints = [
        "/health",
        "/api/metrics",
        "/api/traces",
    ]
    if args.trace_id:
        endpoints += [
            f"/api/traces/{args.trace_id}/graph",
            f"/api/traces/{args.trace_id}/spans",
        ]

    print(f"\n[PRODUCTNAME] Query Stress Test")
    print(f"{'=' * 60}")
    print(f"  API:        {args.url}")
    print(f"  Requests:   {args.requests} per endpoint")
    print(f"  Concurrent: {args.concurrent}")
    print()

    for endpoint in endpoints:
        url = f"{args.url}{endpoint}"
        print(f"Testing: {endpoint}")
        r = stress_endpoint(url, args.requests, args.concurrent)  # args.concurrent is int, not module

        if "p50" in r:
            print(f"  p50={r['p50']:.0f}ms  p95={r['p95']:.0f}ms  p99={r['p99']:.0f}ms  "
                  f"max={r['max']:.0f}ms  errors={r['errors']}/{r['count']}")
        else:
            print(f"  All requests failed ({r['errors']} errors)")
        print()

    print("Done.")
    if not args.trace_id:
        print("Tip: Add --trace-id <id> to also test graph and spans endpoints.")


if __name__ == "__main__":
    main()
