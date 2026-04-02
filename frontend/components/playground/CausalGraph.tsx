"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from "reactflow";
import dagre from "@dagrejs/dagre";
import "reactflow/dist/style.css";

interface GraphData {
  nodes: Array<{
    id: string;
    data: {
      label: string;
      agent_name: string;
      decision_reasoning: string;
      tokens: number;
      cost_usd: number;
      status: string;
      [key: string]: any;
    };
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type?: string;
    animated?: boolean;
  }>;
}

function CustomNode({ data }: { data: any }) {
  const status = (data.status ?? "").toLowerCase();
  const bgColor =
    status === "error"
      ? "bg-red-500/20 border-red-500/50"
      : status === "completed" || status === "ok"
      ? "bg-electric-blue/10 border-electric-blue/40"
      : "bg-slate-gray/10 border-slate-gray/30";

  const tokens = data.tokens ?? data.span?.prompt_tokens ?? 0;
  const cost = data.cost_usd ?? data.cost ?? data.span?.accumulated_cost_usd ?? 0;

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${bgColor} cursor-pointer hover:brightness-110 transition-all min-w-[140px]`}
    >
      <Handle type="target" position={Position.Top} className="!bg-electric-blue !w-2 !h-2" />
      <div className="text-center">
        <p className="text-sm font-semibold text-white">{data.label ?? data.agentName ?? "Agent"}</p>
        <p className="text-xs text-slate-gray mt-1">
          {(Number(tokens) || 0).toLocaleString()} tokens &middot; ${(Number(cost) || 0).toFixed(3)}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-electric-blue !w-2 !h-2" />
    </div>
  );
}

const nodeTypes: NodeTypes = { custom: CustomNode };

function layoutGraph(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 180, height: 70 });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: { x: pos.x - 90, y: pos.y - 35 },
    };
  });
}

export function CausalGraph({
  graphData,
  onNodeClick,
}: {
  graphData: GraphData;
  onNodeClick: (nodeData: GraphData["nodes"][0]["data"]) => void;
}) {
  const edges: Edge[] = useMemo(
    () =>
      (graphData.edges ?? []).map((e) => ({
        ...e,
        style: {
          stroke: e.type === "causal" ? "#F0A500" : "#94A3B8",
          strokeDasharray: e.type === "causal" ? "5 5" : undefined,
          strokeWidth: 2,
        },
        animated: e.type === "causal",
      })),
    [graphData.edges]
  );

  const nodes: Node[] = useMemo(() => {
    const rawNodes = (graphData.nodes ?? []).map((n) => ({
      ...n,
      type: "custom" as const,
    }));
    return layoutGraph(rawNodes, edges);
  }, [graphData.nodes, edges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.data);
    },
    [onNodeClick]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-deep-navy"
      >
        <Background color="#1E293B" gap={20} />
      </ReactFlow>
    </div>
  );
}
