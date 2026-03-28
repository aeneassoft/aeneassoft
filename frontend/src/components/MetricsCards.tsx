'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Metrics {
  total_traces: number;
  error_rate: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  period: string;
}

export default function MetricsCards() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_URL}/api/metrics`);
        const data = await res.json();
        setMetrics(data);
      } catch {
        // Backend might not be available yet
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    {
      label: 'Total Traces',
      value: metrics ? String(metrics.total_traces) : '—',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Error Rate',
      value: metrics ? `${(Number(metrics.error_rate) * 100).toFixed(1)}%` : '—',
      color: metrics && Number(metrics.error_rate) > 0.05 ? 'text-red-400' : 'text-emerald-400',
      bg: metrics && Number(metrics.error_rate) > 0.05 ? 'bg-red-500/10' : 'bg-emerald-500/10',
    },
    {
      label: 'Total Cost (USD)',
      value: metrics ? `$${Number(metrics.total_cost_usd || 0).toFixed(4)}` : '—',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Avg Latency',
      value: metrics ? `${Math.round(Number(metrics.avg_latency_ms || 0))}ms` : '—',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className={`${card.bg} rounded-lg border border-gray-800 p-4`}>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{card.label}</div>
          <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
          {metrics && <div className="text-xs text-gray-600 mt-1">Last {metrics.period}</div>}
        </div>
      ))}
    </div>
  );
}
