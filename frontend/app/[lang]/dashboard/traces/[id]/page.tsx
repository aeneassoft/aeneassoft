"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { fetchAPI, getAPIUrl } from "@/lib/api";
import { CausalGraph } from "@/components/playground/CausalGraph";
import { NodeSidebar } from "@/components/playground/NodeSidebar";
import { ScoreRing } from "@/components/playground/ScoreRing";
import { generateCompliancePDF } from "@/lib/generate-pdf";

interface GraphData {
  nodes: Array<{
    id: string;
    data: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type?: string;
    animated?: boolean;
  }>;
  totalCost?: number;
}

interface ComplianceScore {
  score: number;
  level: string;
  checks: Array<{ name: string; earned: number; weight: number; status: string }>;
}

interface Span {
  span_id: string;
  name: string;
  kind: string;
  status: { code: string; message?: string };
  agent_name: string;
  model_inference?: {
    model_name?: string;
    provider?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    latency_ms?: number;
  };
}

export default function TraceDetailPage() {
  const { lang, id } = useParams<{ lang: string; id: string }>();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [score, setScore] = useState<ComplianceScore | null>(null);
  const [spans, setSpans] = useState<Span[]>([]);
  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchAPI<GraphData>(`/api/traces/${id}/graph`).catch(() => null),
      fetchAPI<ComplianceScore>(`/api/traces/${id}/compliance-score`).catch(() => null),
      fetchAPI<Span[]>(`/api/traces/${id}/spans`).catch(() => []),
    ]).then(([g, s, sp]) => {
      setGraph(g);
      setScore(s);
      setSpans(Array.isArray(sp) ? sp : []);
    }).finally(() => setLoading(false));
  }, [id]);

  async function downloadBackendPDF() {
    setDownloading(true);
    try {
      const token = document.cookie.match(/(?:^|;\s*)token=([^;]*)/)?.[1];
      const res = await fetch(getAPIUrl(`/api/traces/${id}/compliance-report`), {
        headers: {
          ...(token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {}),
        },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `compliance-report-${(id as string).substring(0, 8)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
    } catch {}

    // Fallback: client-side PDF
    if (score) {
      const traceName = graph?.nodes?.[0]?.data?.label as string || id as string;
      const blob = generateCompliancePDF({
        traceId: id as string,
        traceName,
        score,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-report-${(id as string).substring(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setDownloading(false);
  }

  if (loading) return <div className="text-slate-gray p-8">Loading trace...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Trace {(id as string).substring(0, 8)}...</h1>
          <p className="text-sm text-slate-gray mt-1">{id}</p>
        </div>
        <button
          onClick={downloadBackendPDF}
          disabled={downloading}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-gold/90 transition-colors disabled:opacity-50"
        >
          {downloading ? "Generating..." : "Download Article 12 Report (PDF)"}
        </button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3 glass rounded-xl p-4" style={{ height: 450 }}>
          {graph && graph.nodes?.length > 0 ? (
            <CausalGraph graphData={graph as any} onNodeClick={(d: any) => setSelectedNode(d)} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-gray">
              No graph data available
            </div>
          )}
        </div>
        <div className="space-y-4">
          {score && (
            <ScoreRing score={score.score} level={score.level as "HIGH" | "MEDIUM" | "LOW"} />
          )}
          {score?.checks && (
            <div className="glass rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Article 12 Checks</h3>
              <div className="space-y-2">
                {score.checks.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <span className="text-slate-gray">{c.name}</span>
                    <span className={c.status === "pass" ? "text-green-400" : c.status === "partial" ? "text-gold" : "text-red-400"}>
                      {c.earned}/{c.weight}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {graph?.totalCost != null && (
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-slate-gray">Total Cost</p>
              <p className="text-lg font-bold text-white">${graph.totalCost.toFixed(4)}</p>
            </div>
          )}
          {selectedNode && (
            <NodeSidebar data={selectedNode as any} onClose={() => setSelectedNode(null)} />
          )}
        </div>
      </div>

      {spans.length > 0 && (
        <div className="glass rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Spans ({spans.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-light text-left text-slate-gray">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Agent</th>
                  <th className="pb-3 pr-4">Model</th>
                  <th className="pb-3 pr-4">Tokens</th>
                  <th className="pb-3 pr-4">Latency</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {spans.map((s) => (
                  <tr key={s.span_id} className="border-b border-navy-light/50">
                    <td className="py-2 pr-4 text-white">{s.name}</td>
                    <td className="py-2 pr-4 text-slate-gray">{s.agent_name}</td>
                    <td className="py-2 pr-4 text-slate-gray">{s.model_inference?.model_name || "-"}</td>
                    <td className="py-2 pr-4 text-slate-gray">
                      {s.model_inference ? `${s.model_inference.prompt_tokens || 0} / ${s.model_inference.completion_tokens || 0}` : "-"}
                    </td>
                    <td className="py-2 pr-4 text-slate-gray">
                      {s.model_inference?.latency_ms ? `${s.model_inference.latency_ms}ms` : "-"}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${s.status.code === "OK" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                        {s.status.code}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
