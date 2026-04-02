// AeneasSoft Causal Graph Engine
// Builds DAGs from ATP spans with out-of-order buffering

import type { ATPSpan } from '@aeneassoft/atp-schema';

interface GraphNode {
  id: string;
  data: {
    label: string;
    agentName: string;
    agentRole: string;
    operation: string;
    status: string;
    cost: number;
    cost_usd: number;
    tokens: number;
    latencyMs: number;
    provider?: string;
    modelName?: string;
    decision_reasoning?: string;
    agent_name?: string;
    span: any;
  };
  position: { x: number; y: number };
  type: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  animated: boolean;
  style?: Record<string, any>;
  label?: string;
}

interface OrphanEntry {
  span: any;
  bufferedAt: number;
}

const ORPHAN_TIMEOUT_MS = 5000;

export class CausalGraphEngine {
  private graphs = new Map<string, { spans: Map<string, any>; edges: GraphEdge[] }>();
  private orphanBuffer = new Map<string, OrphanEntry>();

  processSpan(span: any): void {
    const traceId = span.trace_id;

    if (!this.graphs.has(traceId)) {
      this.graphs.set(traceId, { spans: new Map(), edges: [] });
    }

    const graph = this.graphs.get(traceId)!;

    // Check if parent exists (if parent_span_id is set)
    if (span.parent_span_id && !graph.spans.has(span.parent_span_id)) {
      // Buffer as orphan — parent hasn't arrived yet
      this.orphanBuffer.set(span.span_id, { span, bufferedAt: Date.now() });
      return;
    }

    // Add span to graph
    graph.spans.set(span.span_id, span);

    // Create parent-child edge
    if (span.parent_span_id) {
      graph.edges.push({
        id: `e-${span.parent_span_id}-${span.span_id}`,
        source: span.parent_span_id,
        target: span.span_id,
        type: 'smoothstep',
        animated: false,
      });
    }

    // Create causal link edges
    if (span.links) {
      for (const link of span.links) {
        graph.edges.push({
          id: `e-link-${link.span_id}-${span.span_id}`,
          source: link.span_id,
          target: span.span_id,
          type: 'smoothstep',
          animated: true,
          style: { strokeDasharray: '5 5', stroke: '#888' },
          label: link.link_type,
        });
      }
    }

    // Check orphan buffer for children waiting for this span
    this._resolveOrphans(traceId);
  }

  private _resolveOrphans(traceId: string): void {
    const graph = this.graphs.get(traceId);
    if (!graph) return;

    const resolved: string[] = [];

    for (const [orphanId, entry] of this.orphanBuffer.entries()) {
      const orphan = entry.span;

      // Check if this orphan's parent now exists
      if (orphan.trace_id === traceId && orphan.parent_span_id && graph.spans.has(orphan.parent_span_id)) {
        resolved.push(orphanId);
      }

      // Timeout: force-add after 5 seconds
      if (Date.now() - entry.bufferedAt > ORPHAN_TIMEOUT_MS) {
        resolved.push(orphanId);
      }
    }

    for (const id of resolved) {
      const entry = this.orphanBuffer.get(id);
      if (entry) {
        this.orphanBuffer.delete(id);
        // Re-process (parent now exists or timed out)
        const graph = this.graphs.get(entry.span.trace_id);
        if (graph) {
          graph.spans.set(entry.span.span_id, entry.span);
          if (entry.span.parent_span_id) {
            graph.edges.push({
              id: `e-${entry.span.parent_span_id}-${entry.span.span_id}`,
              source: entry.span.parent_span_id,
              target: entry.span.span_id,
              type: 'smoothstep',
              animated: false,
            });
          }
          if (entry.span.links) {
            for (const link of entry.span.links) {
              graph.edges.push({
                id: `e-link-${link.span_id}-${entry.span.span_id}`,
                source: link.span_id,
                target: entry.span.span_id,
                type: 'smoothstep',
                animated: true,
                style: { strokeDasharray: '5 5', stroke: '#888' },
                label: link.link_type,
              });
            }
          }
        }
      }
    }
  }

  getGraphForReactFlow(traceId: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const graph = this.graphs.get(traceId);
    if (!graph) return { nodes: [], edges: [] };

    // Flush any remaining orphans for this trace
    this._resolveOrphans(traceId);

    const nodes: GraphNode[] = [];

    for (const [spanId, span] of graph.spans) {
      const cost = this._calculateSpanCost(span);
      nodes.push({
        id: spanId,
        type: 'custom',
        position: { x: 0, y: 0 }, // Positioned by dagre on frontend
        data: {
          label: span.name,
          agentName: span.agent_name,
          agentRole: span.agent_role,
          operation: span.name,
          status: span.status?.code || span.status_code || 'UNSET',
          cost,
          latencyMs: span.model_inference?.latency_ms || span.latency_ms || 0,
          provider: span.model_inference?.provider || span.provider,
          modelName: span.model_inference?.model_name || span.model_name,
          tokens: (span.model_inference?.prompt_tokens || span.prompt_tokens || 0) + (span.model_inference?.completion_tokens || span.completion_tokens || 0),
          cost_usd: cost || span.accumulated_cost_usd || 0,
          decision_reasoning: span.decision_reasoning,
          agent_name: span.agent_name,
          span,
        },
      });
    }

    return { nodes, edges: graph.edges };
  }

  private _calculateSpanCost(span: any): number {
    const modelName = span.model_inference?.model_name || span.model_name;
    if (!modelName) return span.accumulated_cost_usd || 0;
    const { calculateSpanCost } = require('./cost-attribution');
    return calculateSpanCost(span);
  }

  // Build graph from pre-fetched spans (e.g. from ClickHouse)
  buildFromSpans(spans: any[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
    if (spans.length === 0) return { nodes: [], edges: [] };

    const traceId = spans[0].trace_id;
    // Reset graph for this trace
    this.graphs.delete(traceId);

    for (const span of spans) {
      this.processSpan(span);
    }

    return this.getGraphForReactFlow(traceId);
  }
}

// Singleton instance
export const causalGraphEngine = new CausalGraphEngine();
