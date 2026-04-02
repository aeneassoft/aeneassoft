"use client";

import { useEffect, useState } from "react";
import { fetchAPI, getAPIUrl } from "@/lib/api";

interface MonthlyReport {
  period: string;
  summary: {
    total_traces: number;
    total_cost_usd: number;
    error_rate: number;
    avg_latency_ms: number;
    total_tokens: number;
  };
  by_agent: Array<{ agent_id: string; agent_name: string; trace_count: number; total_cost_usd: number; error_rate: number }>;
  by_model: Array<{ model: string; trace_count: number; total_cost_usd: number; total_tokens: number }>;
  top_errors: Array<{ error_type: string; count: number; last_seen: string }>;
  traces: Array<{ trace_id: string; name: string; status: string; cost_usd: number; latency_ms: number; created_at: string }>;
}

function getCurrentMonth() {
  return new Date().toISOString().substring(0, 7);
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(mo) - 1]} ${y}`;
}

function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAPI<MonthlyReport>(`/api/reports/monthly?month=${month}`)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [month]);

  async function downloadFile(type: "pdf" | "csv" | "zip") {
    setDownloading(type);
    try {
      const token = document.cookie.match(/(?:^|;\s*)token=([^;]*)/)?.[1];
      const res = await fetch(getAPIUrl(`/api/reports/monthly/${type}?month=${month}`), {
        headers: token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {},
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const exts: Record<string, string> = { pdf: "pdf", csv: "csv", zip: "zip" };
      a.download = `aeneassoft-${type === "pdf" ? "report" : type === "csv" ? "traces" : "export"}-${month}.${exts[type]}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  const isCurrentMonth = month === getCurrentMonth();
  const s = report?.summary;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Monthly Reports</h1>

      {/* Month navigation */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setMonth(prevMonth(month))}
          className="rounded-lg border border-navy-light px-3 py-1.5 text-sm text-slate-gray hover:text-white hover:border-slate-gray transition-colors">
          &larr;
        </button>
        <span className="text-lg font-semibold text-white min-w-[120px] text-center">
          {formatMonth(month)}
        </span>
        <button onClick={() => !isCurrentMonth && setMonth(nextMonth(month))}
          disabled={isCurrentMonth}
          className="rounded-lg border border-navy-light px-3 py-1.5 text-sm text-slate-gray hover:text-white hover:border-slate-gray transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          &rarr;
        </button>
      </div>

      {loading ? (
        <p className="text-slate-gray">Loading report...</p>
      ) : !report || !s ? (
        <p className="text-slate-gray">No data for this period.</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-slate-gray mb-1">Traces</p>
              <p className="text-xl font-bold text-white">{s.total_traces.toLocaleString()}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-slate-gray mb-1">Total Cost</p>
              <p className="text-xl font-bold text-white">${s.total_cost_usd.toFixed(2)}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-slate-gray mb-1">Error Rate</p>
              <p className="text-xl font-bold text-white">{(s.error_rate * 100).toFixed(1)}%</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-slate-gray mb-1">Avg Latency</p>
              <p className="text-xl font-bold text-white">{s.avg_latency_ms.toFixed(0)}ms</p>
            </div>
          </div>

          {/* Top Agents + Top Errors */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="glass rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Top Agents</h2>
              {report.by_agent.length > 0 ? (
                <div className="space-y-2">
                  {report.by_agent.slice(0, 5).map((a) => (
                    <div key={a.agent_id} className="flex justify-between text-sm">
                      <span className="text-slate-gray">{a.agent_name || a.agent_id}</span>
                      <span className="text-white font-medium">${a.total_cost_usd.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-gray">No agent data</p>
              )}
            </div>
            <div className="glass rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Top Errors</h2>
              {report.top_errors.length > 0 ? (
                <div className="space-y-2">
                  {report.top_errors.slice(0, 5).map((e) => (
                    <div key={e.error_type} className="flex justify-between text-sm">
                      <span className="text-slate-gray truncate max-w-[200px]">{e.error_type}</span>
                      <span className="text-red-400 font-medium">{e.count}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-gray">No errors this period</p>
              )}
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap gap-3 mb-8">
            <button onClick={() => downloadFile("pdf")} disabled={!!downloading}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-gold/90 transition-colors disabled:opacity-50">
              {downloading === "pdf" ? "Generating PDF..." : "PDF Report"}
            </button>
            <button onClick={() => downloadFile("csv")} disabled={!!downloading}
              className="rounded-lg border border-navy-light px-4 py-2 text-sm font-semibold text-slate-gray hover:text-white hover:border-slate-gray transition-colors disabled:opacity-50">
              {downloading === "csv" ? "Preparing..." : "CSV Export"}
            </button>
            <button onClick={() => downloadFile("zip")} disabled={!!downloading}
              className="rounded-lg border border-navy-light px-4 py-2 text-sm font-semibold text-slate-gray hover:text-white hover:border-slate-gray transition-colors disabled:opacity-50">
              {downloading === "zip" ? "Preparing ZIP..." : "ZIP (PDF + CSV + JSON)"}
            </button>
          </div>

          {/* Trace Table */}
          {report.traces.length > 0 && (
            <div className="glass rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-3">
                Traces ({report.traces.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-light text-left text-slate-gray">
                      <th className="pb-2 pr-3">Name</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Cost</th>
                      <th className="pb-2 pr-3">Latency</th>
                      <th className="pb-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.traces.slice(0, 50).map((t) => (
                      <tr key={t.trace_id} className="border-b border-navy-light/50">
                        <td className="py-2 pr-3 text-white">{t.name || t.trace_id.substring(0, 8)}</td>
                        <td className="py-2 pr-3">
                          <span className={`text-xs px-2 py-0.5 rounded ${t.status === "OK" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-gray">${t.cost_usd.toFixed(4)}</td>
                        <td className="py-2 pr-3 text-slate-gray">{t.latency_ms}ms</td>
                        <td className="py-2 text-slate-gray text-xs">{new Date(t.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
