"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CausalGraph } from "@/components/playground/CausalGraph";
import { NodeSidebar } from "@/components/playground/NodeSidebar";
import { ScoreRing } from "@/components/playground/ScoreRing";
import { generateLocalSimulation } from "@/lib/simulation";
import { generateCompliancePDF } from "@/lib/generate-pdf";

export default function PlaygroundPage() {
  const { lang } = useParams<{ lang: string }>();
  const sim = useMemo(() => generateLocalSimulation(), []);
  const [selectedTrace, setSelectedTrace] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);

  const trace = sim.traces[selectedTrace];
  const graph = trace ? sim.graphs[trace.id] : null;
  const score = trace ? sim.scores[trace.id] : null;

  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          {lang === "de" ? "Interaktiver Playground" : "Interactive Playground"}
        </h1>
        <p className="text-slate-gray mb-8">
          {lang === "de"
            ? "Erkunde kausale Graphen mit simulierten Multi-Agenten-Traces."
            : "Explore causal graphs with simulated multi-agent traces."}
        </p>

        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {sim.traces.map((t, i) => (
            <button
              key={t.id}
              onClick={() => { setSelectedTrace(i); setSelectedNode(null); }}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                i === selectedTrace
                  ? "bg-electric-blue text-white"
                  : "bg-navy-mid border border-navy-light text-slate-gray hover:text-white"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 glass rounded-xl p-4" style={{ height: 500 }}>
            {graph && (
              <CausalGraph graphData={graph} onNodeClick={(d: any) => setSelectedNode(d)} />
            )}
          </div>
          <div className="space-y-4">
            {score && (
              <>
                <ScoreRing
                  score={score.score}
                  level={score.level as "HIGH" | "MEDIUM" | "LOW"}
                />
                <button
                  onClick={() => {
                    const blob = generateCompliancePDF({
                      traceId: trace?.id || "demo",
                      traceName: trace?.name || "Demo Trace",
                      score,
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `compliance-report-${(trace?.id || "demo").substring(0, 8)}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-deep-navy hover:bg-gold/90 transition-colors"
                >
                  Download Article 12 Report
                </button>
              </>
            )}
            {trace && (
              <div className="glass rounded-xl p-4 text-sm space-y-2">
                <p className="text-slate-gray">Agents: <span className="text-white">{trace.agent_count}</span></p>
                <p className="text-slate-gray">Tokens: <span className="text-white">{trace.total_tokens.toLocaleString()}</span></p>
                <p className="text-slate-gray">Cost: <span className="text-white">${trace.total_cost_usd.toFixed(4)}</span></p>
                <p className="text-slate-gray">Latency: <span className="text-white">{trace.duration_ms}ms</span></p>
              </div>
            )}
            {selectedNode && (
              <NodeSidebar data={selectedNode as any} onClose={() => setSelectedNode(null)} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
