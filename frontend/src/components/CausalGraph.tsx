'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Handle,
  Position,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const nodeWidth = 280;
const nodeHeight = 100;

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

const statusColors: Record<string, string> = {
  OK: '#10b981',
  ERROR: '#ef4444',
  UNSET: '#6b7280',
};

function CustomNode({ data }: { data: any }) {
  const borderColor = statusColors[data.status] || statusColors.UNSET;

  return (
    <div
      className="bg-gray-900 rounded-lg border-2 p-3 shadow-lg min-w-[260px]"
      style={{ borderColor }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-600" />
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-sm text-white truncate">{data.agentName}</span>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: borderColor + '20', color: borderColor }}
        >
          {data.status}
        </span>
      </div>
      <div className="text-xs text-gray-400 mb-1 truncate">{data.operation}</div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>{data.agentRole}</span>
        {data.provider && <span>{data.provider}</span>}
        {data.latencyMs > 0 && <span>{data.latencyMs}ms</span>}
        {data.cost > 0 && (
          <span className="text-amber-400">${data.cost.toFixed(4)}</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-600" />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

interface CausalGraphProps {
  traceId: string;
  onNodeClick?: (span: any) => void;
}

export default function CausalGraph({ traceId, onNodeClick }: CausalGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [graphMeta, setGraphMeta] = useState<any>(null);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await fetch(`${API_URL}/api/traces/${traceId}/graph`);
        const data = await res.json();

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          data.nodes || [],
          data.edges || []
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setGraphMeta({
          totalCost: data.totalCost,
          costByAgent: data.costByAgent,
          spanCount: data.spanCount,
        });
      } catch {
        // Backend might not be available
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, [traceId, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: any, node: Node) => {
      if (onNodeClick && node.data.span) {
        onNodeClick(node.data.span);
      }
    },
    [onNodeClick]
  );

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading graph...</div>;
  }

  if (nodes.length === 0) {
    return <div className="text-center py-12 text-gray-500">No spans found for this trace</div>;
  }

  return (
    <div className="h-[600px] bg-gray-900 rounded-lg border border-gray-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-950"
      >
        <Background color="#374151" gap={20} />
        <Controls className="!bg-gray-800 !border-gray-700 !text-white" />
        <MiniMap
          nodeColor={(node) => statusColors[node.data?.status] || '#6b7280'}
          className="!bg-gray-900 !border-gray-800"
        />
      </ReactFlow>
    </div>
  );
}
