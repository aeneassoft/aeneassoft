"use client";

import { useEffect, useState } from "react";
import { fetchAPI, getAPIUrl } from "@/lib/api";

interface HealthStatus {
  status: string;
  version?: string;
  services?: { clickhouse?: string; kafka?: string };
}

export default function ConfigPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    fetch(getAPIUrl("/health"))
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  async function exportData(format: "json" | "csv") {
    setExporting(format);
    try {
      const token = document.cookie.match(/(?:^|;\s*)token=([^;]*)/)?.[1];
      const month = new Date().toISOString().substring(0, 7);
      const res = await fetch(getAPIUrl(`/api/reports/monthly/${format}?month=${month}`), {
        headers: token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {},
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `aeneassoft-export-${month}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {} finally {
      setExporting(null);
    }
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Developer Console</h1>

      {/* Connection Status */}
      <div className="glass rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">System Status</h2>
        {loading ? (
          <p className="text-xs text-slate-gray">Checking connections...</p>
        ) : (
          <div className="space-y-3">
            <StatusRow
              label="Backend API"
              value={backendUrl}
              ok={health?.status === "ok"}
            />
            <StatusRow
              label="ClickHouse"
              value="Trace storage"
              ok={health?.services?.clickhouse === "ok" || health?.status === "ok"}
            />
            <StatusRow
              label="Kafka"
              value="Message queue (optional)"
              ok={health?.services?.kafka === "ok"}
              optional
            />
            {health?.version && (
              <p className="text-xs text-slate-gray">Version: {health.version}</p>
            )}
          </div>
        )}
      </div>

      {/* SDK Configuration */}
      <div className="glass rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">SDK Quick Setup</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-gray mb-1">Python</p>
            <pre className="bg-navy-mid border border-navy-light rounded-lg px-3 py-2 text-xs text-off-white font-mono overflow-x-auto">
              pip install aeneas-agentwatch{"\n"}
              {"\n"}import agentwatch{"\n"}agentwatch.init(api_key="local")  # No key needed in local mode
            </pre>
          </div>
          <div>
            <p className="text-xs text-slate-gray mb-1">Node.js</p>
            <pre className="bg-navy-mid border border-navy-light rounded-lg px-3 py-2 text-xs text-off-white font-mono overflow-x-auto">
              npm install @aeneassoft/sdk-node{"\n"}
              {"\n"}import {"{ init }"} from '@aeneassoft/sdk-node';{"\n"}init({"{ apiKey: 'local' }"});
            </pre>
          </div>
        </div>
      </div>

      {/* Data Export */}
      <div className="glass rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Data Export</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => exportData("json")}
            disabled={!!exporting}
            className="rounded-lg border border-navy-light px-4 py-2 text-sm font-semibold text-slate-gray hover:text-white hover:border-slate-gray transition-colors disabled:opacity-50"
          >
            {exporting === "json" ? "Exporting..." : "Export Traces (JSON)"}
          </button>
          <button
            onClick={() => exportData("csv")}
            disabled={!!exporting}
            className="rounded-lg border border-navy-light px-4 py-2 text-sm font-semibold text-slate-gray hover:text-white hover:border-slate-gray transition-colors disabled:opacity-50"
          >
            {exporting === "csv" ? "Exporting..." : "Export Traces (CSV)"}
          </button>
        </div>
      </div>

      {/* Environment Info */}
      <div className="glass rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Environment</h2>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-gray">API URL</span>
            <span className="text-white font-mono">{backendUrl}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-gray">Mode</span>
            <span className="text-white font-mono">
              {process.env.NEXT_PUBLIC_LOCAL_MODE === "true" ? "Local (no auth)" : "Cloud"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-gray">Dashboard</span>
            <span className="text-white font-mono">Next.js {process.env.NEXT_PUBLIC_VERCEL_ENV || "local"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, ok, optional }: { label: string; value: string; ok?: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-400" : optional ? "bg-slate-gray/40" : "bg-red-400"}`} />
        <span className="text-sm text-white">{label}</span>
      </div>
      <span className="text-xs text-slate-gray">{value}</span>
    </div>
  );
}
