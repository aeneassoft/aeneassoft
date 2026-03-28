'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Trace {
  trace_id: string;
  span_id: string;
  name: string;
  agent_name: string;
  agent_role: string;
  status_code: string;
  start_time: string;
  latency_ms: number | null;
  accumulated_cost_usd: number | null;
  model_name: string | null;
  provider: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OK: 'bg-emerald-500/20 text-emerald-400',
    ERROR: 'bg-red-500/20 text-red-400',
    UNSET: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.UNSET}`}>
      {status}
    </span>
  );
}

export default function TraceList() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchTraces = async () => {
      try {
        const res = await fetch(`${API_URL}/api/traces`);
        const data = await res.json();
        setTraces(data.traces || []);
      } catch {
        // Backend might not be available yet
      } finally {
        setLoading(false);
      }
    };

    fetchTraces();
    const interval = setInterval(fetchTraces, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading traces...
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-2">No traces yet</div>
        <div className="text-sm text-gray-600">
          Run <code className="bg-gray-800 px-2 py-1 rounded">python demo/run.py</code> to generate sample data
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 text-left">
            <th className="pb-3 pr-4">Trace ID</th>
            <th className="pb-3 pr-4">Agent</th>
            <th className="pb-3 pr-4">Operation</th>
            <th className="pb-3 pr-4">Time</th>
            <th className="pb-3 pr-4">Latency</th>
            <th className="pb-3 pr-4">Cost</th>
            <th className="pb-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {traces.map((trace) => (
            <tr
              key={trace.trace_id + trace.span_id}
              onClick={() => router.push(`/traces/${trace.trace_id}`)}
              className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
            >
              <td className="py-3 pr-4 font-mono text-xs text-blue-400">
                {trace.trace_id.substring(0, 8)}...
              </td>
              <td className="py-3 pr-4">
                <div className="font-medium">{trace.agent_name}</div>
                <div className="text-xs text-gray-500">{trace.agent_role}</div>
              </td>
              <td className="py-3 pr-4 text-gray-300">{trace.name}</td>
              <td className="py-3 pr-4 text-gray-500 text-xs">
                {trace.start_time ? new Date(trace.start_time).toLocaleString() : '—'}
              </td>
              <td className="py-3 pr-4 text-gray-400">
                {trace.latency_ms ? `${trace.latency_ms}ms` : '—'}
              </td>
              <td className="py-3 pr-4 text-amber-400 font-mono text-xs">
                {trace.accumulated_cost_usd
                  ? `$${Number(trace.accumulated_cost_usd).toFixed(4)}`
                  : '—'}
              </td>
              <td className="py-3">
                <StatusBadge status={trace.status_code} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
