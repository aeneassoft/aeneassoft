"use client";

import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";
import { OnboardingGuide } from "@/components/dashboard/OnboardingGuide";

interface Metrics {
  totalTraces: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
}

interface UserInfo {
  role?: string;
  name?: string;
  email?: string;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  async function loadMetrics() {
    try {
      const data = await fetchAPI<Metrics>("/api/metrics");
      setMetrics(data);
    } catch {
      setMetrics({ totalTraces: 0, totalTokens: 0, totalCost: 0, avgLatency: 0, errorRate: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetrics();
    fetchAPI<UserInfo>("/auth/me").then((u) => {
      setUser(u);
      if (u.role === "admin" && !localStorage.getItem("admin_welcome_dismissed")) {
        setShowWelcome(true);
      }
    }).catch(() => {});
  }, []);

  if (loading) {
    return <div className="text-slate-gray">Loading...</div>;
  }

  if (!metrics || metrics.totalTraces === 0) {
    return <OnboardingGuide onTraceReceived={loadMetrics} />;
  }

  // GitHub star request — shows once after 50+ traces
  const [showStarBanner, setShowStarBanner] = useState(false);
  useEffect(() => {
    if (metrics && metrics.totalTraces >= 50) {
      const dismissed = localStorage.getItem("star_banner_dismissed");
      if (!dismissed) setShowStarBanner(true);
    }
  }, [metrics]);

  function dismissStarBanner() {
    localStorage.setItem("star_banner_dismissed", "1");
    setShowStarBanner(false);
  }

  const cards = [
    { label: "Total Traces", value: metrics.totalTraces.toLocaleString() },
    { label: "Total Tokens", value: metrics.totalTokens.toLocaleString() },
    { label: "Total Cost", value: `$${metrics.totalCost.toFixed(2)}` },
    { label: "Avg Latency", value: `${metrics.avgLatency.toFixed(0)}ms` },
    { label: "Error Rate", value: `${(metrics.errorRate * 100).toFixed(1)}%` },
  ];

  function dismissWelcome() {
    localStorage.setItem("admin_welcome_dismissed", "1");
    setShowWelcome(false);
  }

  return (
    <div>
      {showWelcome && (
        <div className="glass rounded-xl p-4 mb-6 flex items-center justify-between border border-electric-blue/40">
          <div>
            <span className="text-electric-blue font-semibold text-sm">Willkommen, Herr CTO (in spe).</span>
            <span className="text-off-white text-sm ml-2">Voller Zugriff &mdash; au&szlig;er auf die Kreditkarte.</span>
            <span className="text-slate-gray text-xs ml-2">Passwort: bcrypt-gehasht, nur deins.</span>
          </div>
          <button onClick={dismissWelcome} className="text-slate-gray hover:text-white text-sm px-2">&#10005;</button>
        </div>
      )}
      {showStarBanner && (
        <div className="glass rounded-xl p-4 mb-6 flex items-center justify-between border border-gold/30">
          <div className="flex items-center gap-3">
            <span className="text-gold text-lg">&#9733;</span>
            <p className="text-sm text-off-white">
              Finding AeneasSoft useful? Support open source —{" "}
              <a href="https://github.com/aeneassoft/aeneassoft" target="_blank" rel="noopener noreferrer" className="text-electric-blue hover:underline font-semibold">
                star us on GitHub
              </a>
            </p>
          </div>
          <button onClick={dismissStarBanner} className="text-slate-gray hover:text-white text-sm px-2">&#10005;</button>
        </div>
      )}
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-xl p-4">
            <p className="text-xs text-slate-gray mb-1">{c.label}</p>
            <p className="text-xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
