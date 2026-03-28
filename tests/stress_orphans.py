"""
[PRODUCTNAME] Stress Test — Out-of-Order Spans (Orphan Buffer)
Sendet Kind-Spans VOR Parent-Spans um den Causal Graph Engine zu testen.
Der Graph muss trotzdem korrekt rekonstruiert werden.

Usage:
    python tests/stress_orphans.py
    python tests/stress_orphans.py --levels 6 --children 4
"""
import uuid
import time
import httpx
import random
import argparse

DEFAULT_INGEST_URL = "http://localhost:3001/api/ingest"
DEFAULT_LEVELS = 4
DEFAULT_CHILDREN = 3


def make_span(trace_id, span_id, parent_id=None, name="op", level=0):
    return {
        "trace_id": trace_id,
        "span_id": span_id,
        "parent_span_id": parent_id,
        "name": f"orphan.test.level-{level}.{name}",
        "kind": "INTERNAL",
        "start_time_unix_nano": int(time.time() * 1e9),
        "end_time_unix_nano": int((time.time() + 0.5) * 1e9),
        "status": {"code": "OK"},
        "agent_id": f"agent-{span_id[:4]}",
        "agent_name": f"L{level}-Agent",
        "agent_role": f"Level{level}Worker",
        "model_inference": {
            "model_name": "gpt-4o-mini",
            "provider": "OpenAI",
            "prompt_tokens": 50,
            "completion_tokens": 25,
            "latency_ms": 50,
        },
    }


def build_tree(trace_id, levels, children_per_node):
    """Build a tree of spans. Returns list of (span, depth)."""
    spans = []
    root_id = uuid.uuid4().hex[:16]
    spans.append((make_span(trace_id, root_id, name="root", level=0), 0))

    current_level_ids = [root_id]
    for level in range(1, levels + 1):
        next_level_ids = []
        for parent_id in current_level_ids:
            for _ in range(children_per_node):
                child_id = uuid.uuid4().hex[:16]
                spans.append((
                    make_span(trace_id, child_id, parent_id, name=f"worker", level=level),
                    level,
                ))
                next_level_ids.append(child_id)
        current_level_ids = next_level_ids

    return spans, root_id


def main():
    parser = argparse.ArgumentParser(description="[PRODUCTNAME] Orphan Buffer Stress Test")
    parser.add_argument("--url", default=DEFAULT_INGEST_URL)
    parser.add_argument("--levels", type=int, default=DEFAULT_LEVELS)
    parser.add_argument("--children", type=int, default=DEFAULT_CHILDREN)
    parser.add_argument("--seed", type=int, help="Random seed for reproducibility")
    args = parser.parse_args()

    if args.seed:
        random.seed(args.seed)

    trace_id = uuid.uuid4().hex
    spans_with_depth, root_id = build_tree(trace_id, args.levels, args.children)

    total_nodes = sum(args.children ** i for i in range(args.levels + 1))
    print(f"\n[PRODUCTNAME] Orphan Buffer Stress Test")
    print(f"{'=' * 50}")
    print(f"  Trace ID:   {trace_id}")
    print(f"  Tree depth: {args.levels} levels")
    print(f"  Children/node: {args.children}")
    print(f"  Total spans:   {len(spans_with_depth)} (expected ~{total_nodes})")

    # Shuffle: children arrive before parents
    shuffled = [(span, depth) for span, depth in spans_with_depth]
    random.shuffle(shuffled)

    # Show first few to illustrate randomness
    print(f"\nFirst 5 spans by arrival order:")
    for span, depth in shuffled[:5]:
        parent = span.get("parent_span_id", "ROOT")
        print(f"  [{depth}] {span['name']} (parent: {str(parent)[:8] if parent else 'none'})")

    print(f"\nSending {len(shuffled)} spans in RANDOM order...")
    start = time.time()
    ok = 0
    err = 0

    for span, _ in shuffled:
        try:
            r = httpx.post(args.url, json=span, timeout=5)
            if r.status_code == 202:
                ok += 1
            else:
                err += 1
        except Exception as e:
            err += 1
            print(f"  Error: {e}")

    elapsed = time.time() - start
    print(f"\nResults:")
    print(f"  Accepted: {ok}/{len(shuffled)}")
    print(f"  Errors:   {err}")
    print(f"  Time:     {elapsed:.2f}s")

    api_base = args.url.replace("/api/ingest", "")
    print(f"\nVerify graph reconstruction:")
    print(f"  API:     {api_base}/api/traces/{trace_id}/graph")
    print(f"  UI:      http://localhost:3000/traces/{trace_id}")
    print(f"\nExpected: {len(spans_with_depth)} nodes, correct parent-child edges despite random order.")


if __name__ == "__main__":
    main()
