import { describe, it, expect } from 'vitest';
import { CausalGraphEngine } from './causal-graph';

function makeSpan(overrides: Record<string, any> = {}) {
  return {
    trace_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    span_id: 'span000000000001',
    name: 'test.operation',
    kind: 'INTERNAL',
    start_time_unix_nano: 1700000000000000000,
    end_time_unix_nano: 1700000001000000000,
    status: { code: 'OK' },
    agent_id: 'agent-01',
    agent_name: 'TestAgent',
    agent_role: 'Test',
    ...overrides,
  };
}

describe('CausalGraphEngine', () => {
  it('should build a graph from a single root span', () => {
    const engine = new CausalGraphEngine();
    const span = makeSpan();

    engine.processSpan(span);
    const graph = engine.getGraphForReactFlow(span.trace_id);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
    expect(graph.nodes[0].data.agentName).toBe('TestAgent');
  });

  it('should create parent-child edges', () => {
    const engine = new CausalGraphEngine();
    const parent = makeSpan({ span_id: 'parent0000000001' });
    const child = makeSpan({
      span_id: 'child00000000001',
      parent_span_id: 'parent0000000001',
      name: 'child.operation',
    });

    engine.processSpan(parent);
    engine.processSpan(child);

    const graph = engine.getGraphForReactFlow(parent.trace_id);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].source).toBe('parent0000000001');
    expect(graph.edges[0].target).toBe('child00000000001');
  });

  it('should handle out-of-order spans via orphan buffer', () => {
    const engine = new CausalGraphEngine();
    const parent = makeSpan({ span_id: 'parent0000000001' });
    const child = makeSpan({
      span_id: 'child00000000001',
      parent_span_id: 'parent0000000001',
      name: 'child.operation',
    });

    // Child arrives BEFORE parent
    engine.processSpan(child);
    // Parent arrives after
    engine.processSpan(parent);

    const graph = engine.getGraphForReactFlow(parent.trace_id);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });

  it('should handle causal links (non-parent relationships)', () => {
    const engine = new CausalGraphEngine();
    const span1 = makeSpan({ span_id: 'research00000001', name: 'research' });
    const span2 = makeSpan({
      span_id: 'analysis00000001',
      name: 'analysis',
      links: [
        {
          trace_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
          span_id: 'research00000001',
          link_type: 'REQUIRES',
        },
      ],
    });

    engine.processSpan(span1);
    engine.processSpan(span2);

    const graph = engine.getGraphForReactFlow(span1.trace_id);
    expect(graph.nodes).toHaveLength(2);
    // Should have 1 causal link edge
    const linkEdges = graph.edges.filter((e) => e.label === 'REQUIRES');
    expect(linkEdges).toHaveLength(1);
    expect(linkEdges[0].style?.strokeDasharray).toBe('5 5');
  });

  it('should build graph from pre-fetched spans', () => {
    const engine = new CausalGraphEngine();
    const spans = [
      makeSpan({ span_id: 'orch000000000001', name: 'orchestrator' }),
      makeSpan({
        span_id: 'worker0000000001',
        parent_span_id: 'orch000000000001',
        name: 'worker',
      }),
      makeSpan({
        span_id: 'worker0000000002',
        parent_span_id: 'orch000000000001',
        name: 'worker2',
        links: [
          {
            trace_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
            span_id: 'worker0000000001',
            link_type: 'FOLLOWS_FROM',
          },
        ],
      }),
    ];

    const graph = engine.buildFromSpans(spans);
    expect(graph.nodes).toHaveLength(3);
    // 2 parent-child + 1 causal link
    expect(graph.edges).toHaveLength(3);
  });

  it('should return empty graph for unknown trace', () => {
    const engine = new CausalGraphEngine();
    const graph = engine.getGraphForReactFlow('nonexistent');
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});
