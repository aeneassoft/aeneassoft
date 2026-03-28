"""
[PRODUCTNAME] Stress Test — ClickHouse direkte Abfragen
Prüft Storage-Performance und Datenintegrität direkt in ClickHouse.

Voraussetzung: docker compose up -d && ClickHouse ist healthy

Usage:
    python tests/stress_clickhouse.py
    python tests/stress_clickhouse.py --url http://localhost:8123 --db productname
"""
import time
import httpx
import argparse
import json

DEFAULT_CH_URL = "http://localhost:8123"
DEFAULT_DB = "productname"


def query(url: str, db: str, sql: str) -> dict:
    start = time.time()
    try:
        r = httpx.post(
            url,
            content=sql,
            params={"database": db},
            timeout=30,
        )
        elapsed = (time.time() - start) * 1000
        if r.status_code == 200:
            try:
                data = r.json()
                return {"ok": True, "data": data.get("data", []), "latency_ms": elapsed, "rows": data.get("rows", 0)}
            except Exception:
                return {"ok": True, "raw": r.text[:200], "latency_ms": elapsed}
        else:
            return {"ok": False, "error": r.text[:200], "latency_ms": elapsed}
    except Exception as e:
        return {"ok": False, "error": str(e), "latency_ms": -1}


def run_query(label: str, url: str, db: str, sql: str):
    print(f"\n{label}")
    print(f"  SQL: {sql.strip()[:80]}...")
    result = query(url, db, sql)
    if result["ok"]:
        print(f"  Latency: {result['latency_ms']:.0f}ms")
        if "data" in result and result["data"]:
            for row in result["data"][:5]:
                print(f"  Row: {json.dumps(row)[:120]}")
        elif "raw" in result:
            print(f"  Raw: {result['raw']}")
    else:
        print(f"  ERROR: {result.get('error', 'unknown')}")
    return result


def main():
    parser = argparse.ArgumentParser(description="[PRODUCTNAME] ClickHouse Stress Test")
    parser.add_argument("--url", default=DEFAULT_CH_URL)
    parser.add_argument("--db", default=DEFAULT_DB)
    args = parser.parse_args()

    print(f"\n[PRODUCTNAME] ClickHouse Stress Test")
    print(f"{'=' * 60}")
    print(f"  URL: {args.url}")
    print(f"  DB:  {args.db}")

    # 1. Basic connectivity
    run_query(
        "1. Connectivity check",
        args.url, args.db,
        "SELECT 1 AS ok FORMAT JSON",
    )

    # 2. Count total spans
    run_query(
        "2. Total span count",
        args.url, args.db,
        "SELECT count() AS total FROM agent_spans FORMAT JSON",
    )

    # 3. Top 10 most expensive traces
    run_query(
        "3. Top 10 most expensive traces",
        args.url, args.db,
        """
        SELECT
          trace_id,
          count() AS span_count,
          sum(accumulated_cost_usd) AS total_cost_usd,
          sum(prompt_tokens) AS total_prompt_tokens,
          sum(completion_tokens) AS total_completion_tokens
        FROM agent_spans
        GROUP BY trace_id
        ORDER BY total_cost_usd DESC
        LIMIT 10
        FORMAT JSON
        """,
    )

    # 4. Error rate by agent
    run_query(
        "4. Error rate by agent role",
        args.url, args.db,
        """
        SELECT
          agent_role,
          count() AS total,
          countIf(status_code = 'ERROR') AS errors,
          round(countIf(status_code = 'ERROR') / count() * 100, 2) AS error_pct
        FROM agent_spans
        GROUP BY agent_role
        ORDER BY errors DESC
        FORMAT JSON
        """,
    )

    # 5. Model usage breakdown
    run_query(
        "5. Model usage and costs",
        args.url, args.db,
        """
        SELECT
          provider,
          model_name,
          count() AS calls,
          sum(prompt_tokens) AS total_prompt_tokens,
          sum(completion_tokens) AS total_completion_tokens,
          avg(latency_ms) AS avg_latency_ms,
          sum(accumulated_cost_usd) AS total_cost_usd
        FROM agent_spans
        WHERE model_name IS NOT NULL
        GROUP BY provider, model_name
        ORDER BY calls DESC
        FORMAT JSON
        """,
    )

    # 6. Timeline (spans per minute)
    run_query(
        "6. Span ingestion timeline (last 10 minutes)",
        args.url, args.db,
        """
        SELECT
          toStartOfMinute(start_time) AS minute,
          count() AS spans
        FROM agent_spans
        WHERE start_time >= now() - INTERVAL 10 MINUTE
        GROUP BY minute
        ORDER BY minute DESC
        FORMAT JSON
        """,
    )

    # 7. Compliance-flagged spans
    run_query(
        "7. EU AI Act compliance-flagged spans",
        args.url, args.db,
        """
        SELECT
          trace_id,
          name,
          agent_name,
          compliance_flags
        FROM agent_spans
        WHERE has(compliance_flags, 'eu_ai_act_art12_relevant')
        ORDER BY start_time DESC
        LIMIT 10
        FORMAT JSON
        """,
    )

    # 8. Performance: complex aggregation query
    print(f"\n8. Performance: complex aggregation (measures query latency)")
    sql = """
    SELECT
      trace_id,
      count() AS span_count,
      min(start_time) AS trace_start,
      max(end_time) AS trace_end,
      dateDiff('millisecond', min(start_time), max(end_time)) AS trace_duration_ms,
      sum(accumulated_cost_usd) AS total_cost,
      groupArray(status_code) AS statuses
    FROM agent_spans
    GROUP BY trace_id
    ORDER BY trace_start DESC
    LIMIT 50
    FORMAT JSON
    """
    r = query(args.url, args.db, sql)
    print(f"  Latency: {r['latency_ms']:.0f}ms for top-50 trace aggregation")
    if r.get("data"):
        print(f"  Returned {len(r['data'])} traces")

    # 9. Causal links table
    run_query(
        "9. Causal links count",
        args.url, args.db,
        "SELECT count() AS total, groupArray(link_type) AS types FROM agent_causal_links FORMAT JSON",
    )

    print(f"\n{'=' * 60}")
    print("ClickHouse Stress Test complete.")


if __name__ == "__main__":
    main()
