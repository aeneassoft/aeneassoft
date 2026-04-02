"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";

interface AlertRule { id: string; name: string; condition: string; threshold: number; enabled: boolean; }
interface AlertEvent { id: string; ruleName: string; triggeredAt: string; value: number; message: string; }

interface CBStatus {
  status: string;
  paused_until?: string | null;
  budget_override?: number | null;
  budget: { current_hour_cost: number; limit: number | null; remaining: number | null; exceeded: boolean };
  error_rate: { current_rate: number; window_calls: number; limit: number | null; exceeded: boolean };
  call_rate: { current_minute: number };
  by_agent: Array<{ agent_id: string; agent_name: string; cost_usd: number }>;
  blocked: { count: number; estimated_savings: number };
}

export default function DefensePage() {
  const [cbStatus, setCbStatus] = useState<CBStatus | null>(null);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [budgetValue, setBudgetValue] = useState("10.00");
  const [errorEnabled, setErrorEnabled] = useState(false);
  const [errorValue, setErrorValue] = useState("50");
  const [email, setEmail] = useState("");

  // CB Controls state
  const [pauseSeconds, setPauseSeconds] = useState("60");
  const [budgetAdd, setBudgetAdd] = useState("5.00");
  const [cbAction, setCbAction] = useState(false);

  const loadData = useCallback(async () => {
    const [status, r, h] = await Promise.all([
      fetchAPI<CBStatus>("/api/circuit-breaker/status").catch(() => null),
      fetchAPI<AlertRule[]>("/api/alerts").catch(() => []),
      fetchAPI<AlertEvent[]>("/api/alerts/history").catch(() => []),
    ]);
    setCbStatus(status);
    setRules(r);
    setHistory(h);

    const budgetRule = r.find((x) => x.condition === "cost_per_hour");
    if (budgetRule) { setBudgetEnabled(budgetRule.enabled); setBudgetValue(String(budgetRule.threshold)); }
    const errorRule = r.find((x) => x.condition === "error_rate");
    if (errorRule) { setErrorEnabled(errorRule.enabled); setErrorValue(String(Math.round(errorRule.threshold * 100))); }
  }, []);

  useEffect(() => {
    // Pre-fill email from JWT
    const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
    if (match) {
      try { const p = JSON.parse(atob(decodeURIComponent(match[1]).split(".")[1])); if (p.email) setEmail(p.email); } catch {}
    }
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAPI<CBStatus>("/api/circuit-breaker/status").then(setCbStatus).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      for (const rule of rules) { await fetchAPI(`/api/alerts/${rule.id}`, { method: "DELETE" }); }
      const newRules: AlertRule[] = [];
      if (budgetEnabled && parseFloat(budgetValue) > 0) {
        const r = await fetchAPI<AlertRule>("/api/alerts", { method: "POST", body: JSON.stringify({ name: "Budget Limit", condition: "cost_per_hour", threshold: parseFloat(budgetValue), action_type: "email", action_target: email }) });
        newRules.push(r);
      }
      if (errorEnabled && parseFloat(errorValue) > 0) {
        const r = await fetchAPI<AlertRule>("/api/alerts", { method: "POST", body: JSON.stringify({ name: "Error Rate Limit", condition: "error_rate", threshold: parseFloat(errorValue) / 100, action_type: "email", action_target: email }) });
        newRules.push(r);
      }
      setRules(newRules);
      await loadData();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  }

  async function handlePause() {
    setCbAction(true);
    try {
      await fetchAPI("/api/circuit-breaker/pause", { method: "POST", body: JSON.stringify({ seconds: parseInt(pauseSeconds) || 60 }) });
      await loadData();
    } catch (err: any) { alert(err.message); } finally { setCbAction(false); }
  }

  async function handleResume() {
    setCbAction(true);
    try {
      await fetchAPI("/api/circuit-breaker/resume", { method: "POST", body: JSON.stringify({}) });
      await loadData();
    } catch (err: any) { alert(err.message); } finally { setCbAction(false); }
  }

  async function handleBudgetOverride() {
    setCbAction(true);
    try {
      await fetchAPI("/api/circuit-breaker/override", { method: "POST", body: JSON.stringify({ additional_budget: parseFloat(budgetAdd) || 5 }) });
      await loadData();
    } catch (err: any) { alert(err.message); } finally { setCbAction(false); }
  }

  if (loading) return <p className="text-slate-gray">Loading...</p>;

  const b = cbStatus?.budget;
  const e = cbStatus?.error_rate;
  const cr = cbStatus?.call_rate;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Active Defense</h1>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
          cbStatus?.status === "armed" ? "bg-green-900/30 text-green-400 border border-green-500/30" :
          cbStatus?.status === "alert_only" ? "bg-gold/10 text-gold border border-gold/30" :
          cbStatus?.status === "paused" ? "bg-orange-900/30 text-orange-400 border border-orange-500/30" :
          cbStatus?.status === "half_open" ? "bg-blue-900/30 text-blue-400 border border-blue-500/30" :
          "bg-navy-mid text-slate-gray border border-navy-light"
        }`}>
          {cbStatus?.status === "armed" ? "ARMED" :
           cbStatus?.status === "alert_only" ? "ALERT ONLY" :
           cbStatus?.status === "paused" ? "PAUSED" :
           cbStatus?.status === "half_open" ? "HALF-OPEN (PROBING)" :
           "DISABLED"}
        </span>
      </div>

      {/* Section 0: Circuit Breaker Controls */}
      <div className="glass rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-white mb-2">Circuit Breaker Controls</h2>
        <p className="text-[11px] text-slate-gray mb-3">Pause the circuit breaker to let calls through temporarily. Add budget to raise the hourly limit. Resume returns to active monitoring. All actions are logged for EU AI Act compliance.</p>
        <div className="flex flex-wrap items-end gap-4">
          {/* Pause */}
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-[10px] text-slate-gray mb-1">Pause (seconds)</label>
              <input type="number" min="10" max="86400" value={pauseSeconds} onChange={(e) => setPauseSeconds(e.target.value)}
                className="w-20 rounded-lg bg-navy-mid border border-navy-light px-2 py-1.5 text-sm text-white focus:outline-none focus:border-electric-blue" />
            </div>
            <button onClick={handlePause} disabled={cbAction || cbStatus?.status === "paused"}
              className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 transition-colors disabled:opacity-40">
              Pause
            </button>
          </div>

          {/* Resume */}
          {(cbStatus?.status === "paused" || cbStatus?.status === "half_open") && (
            <button onClick={handleResume} disabled={cbAction}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 transition-colors disabled:opacity-40">
              Resume
            </button>
          )}

          {/* Budget Override */}
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-[10px] text-slate-gray mb-1">Add Budget ($)</label>
              <input type="number" min="0.01" step="0.01" value={budgetAdd} onChange={(e) => setBudgetAdd(e.target.value)}
                className="w-20 rounded-lg bg-navy-mid border border-navy-light px-2 py-1.5 text-sm text-white focus:outline-none focus:border-electric-blue" />
            </div>
            <button onClick={handleBudgetOverride} disabled={cbAction}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-40">
              +Budget
            </button>
          </div>

          {/* Budget Override Indicator */}
          {cbStatus?.budget_override != null && cbStatus.budget_override > 0 && (
            <span className="text-[10px] text-blue-400 bg-blue-900/30 border border-blue-500/30 px-2 py-1 rounded">
              Override: +${cbStatus.budget_override.toFixed(2)}
            </span>
          )}
        </div>

        {/* Paused countdown */}
        {cbStatus?.status === "paused" && cbStatus?.paused_until && (
          <p className="text-xs text-orange-400 mt-3">
            Paused until {new Date(cbStatus.paused_until).toLocaleTimeString()}. Next call after timeout = probe.
          </p>
        )}
      </div>

      {/* Section 1: Real-time Gauge */}
      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Live Status</h2>
          <span className="text-[10px] text-slate-gray">Auto-refreshes every 10s</span>
        </div>
        <div className="space-y-4">
          <GaugeBar
            label="Budget (last hour)"
            current={b?.current_hour_cost || 0}
            limit={b?.limit ?? null}
            format={(v) => `$${v.toFixed(2)}`}
            exceeded={b?.exceeded}
          />
          <GaugeBar
            label="Error Rate (last 5 min)"
            current={(e?.current_rate || 0) * 100}
            limit={e?.limit != null ? e.limit * 100 : null}
            format={(v) => `${v.toFixed(1)}%`}
            exceeded={e?.exceeded}
            suffix={e?.window_calls != null ? `${e.window_calls} calls` : undefined}
          />
          <GaugeBar
            label="Call Rate (last min)"
            current={cr?.current_minute || 0}
            limit={null}
            format={(v) => `${v}`}
          />
        </div>
      </div>

      {/* Section 2: Top Agents by Cost */}
      {cbStatus?.by_agent && cbStatus.by_agent.length > 0 && (
        <div className="glass rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-3">Top Agents by Cost (last hour)</h2>
          <div className="space-y-2">
            {cbStatus.by_agent.map((a) => {
              const maxCost = cbStatus.by_agent[0]?.cost_usd || 1;
              return (
                <div key={a.agent_id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-gray w-32 truncate">{a.agent_name}</span>
                  <div className="flex-1 bg-navy-mid rounded-full h-2">
                    <div className="bg-electric-blue rounded-full h-2 transition-all" style={{ width: `${Math.min(100, (a.cost_usd / maxCost) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-white font-medium w-16 text-right">${a.cost_usd.toFixed(4)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 3: Block History + Estimated Savings */}
      {(cbStatus?.blocked?.count ?? 0) > 0 && (
        <div className="glass rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-3">Blocked Requests</h2>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-xs text-slate-gray">Requests Blocked</p>
              <p className="text-xl font-bold text-red-400">{cbStatus!.blocked.count}</p>
            </div>
            <div>
              <p className="text-xs text-slate-gray">Estimated Savings</p>
              <p className="text-xl font-bold text-green-400">${cbStatus!.blocked.estimated_savings.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Configuration */}
      <div className="glass rounded-xl p-5 mb-6 space-y-5">
        <h2 className="text-sm font-semibold text-white">Configuration</h2>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-white mb-1">Budget Limit</p>
            <div className="flex items-center gap-2">
              <span className="text-slate-gray">$</span>
              <input type="number" step="0.01" min="0" value={budgetValue} onChange={(e) => setBudgetValue(e.target.value)} disabled={!budgetEnabled}
                className="w-32 rounded-lg bg-navy-mid border border-navy-light px-3 py-1.5 text-sm text-white focus:outline-none focus:border-electric-blue disabled:opacity-40" />
              <span className="text-xs text-slate-gray">per hour</span>
            </div>
          </div>
          <ToggleButton enabled={budgetEnabled} onToggle={() => setBudgetEnabled(!budgetEnabled)} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-white mb-1">Error Rate Limit</p>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" max="100" value={errorValue} onChange={(e) => setErrorValue(e.target.value)} disabled={!errorEnabled}
                className="w-20 rounded-lg bg-navy-mid border border-navy-light px-3 py-1.5 text-sm text-white focus:outline-none focus:border-electric-blue disabled:opacity-40" />
              <span className="text-xs text-slate-gray">% error rate</span>
            </div>
          </div>
          <ToggleButton enabled={errorEnabled} onToggle={() => setErrorEnabled(!errorEnabled)} />
        </div>

        <div>
          <p className="text-sm font-medium text-white mb-1">Notify me at</p>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full max-w-sm rounded-lg bg-navy-mid border border-navy-light px-3 py-1.5 text-sm text-white focus:outline-none focus:border-electric-blue" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="rounded-lg bg-electric-blue px-5 py-2 text-sm font-semibold text-white hover:bg-electric-blue/90 transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Section 5: Alert History */}
      <h2 className="text-sm font-semibold text-white mb-3">Alert History</h2>
      {history.length === 0 ? (
        <p className="text-xs text-slate-gray">No alerts triggered yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map((h) => {
            const isCB = h.message?.includes("circuit_breaker") || h.message?.includes("budget_increased");
            return (
              <div key={h.id} className="glass rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCB && <CBEventBadge message={h.message} />}
                  <div>
                    <p className="text-sm text-white">{h.ruleName}</p>
                    <p className="text-xs text-slate-gray">{h.message}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-gray shrink-0">{new Date(h.triggeredAt).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Section 6: Recovery Info */}
      <div className="glass rounded-xl p-5 mt-6">
        <h2 className="text-sm font-semibold text-white mb-3">Safe Pause &amp; Resume</h2>
        <p className="text-xs text-slate-gray mb-3">
          When the circuit breaker fires, your SDK can recover programmatically:
        </p>
        <pre className="bg-navy-mid border border-navy-light rounded-lg p-3 text-xs text-off-white overflow-x-auto font-mono whitespace-pre">{`except CircuitBreakerException as e:
    e.monitor.pause(60)           # Probe after 60s
    e.monitor.increase_budget(5)  # Or: raise budget
    e.monitor.reset_windows()     # Emergency reset`}</pre>
        <p className="text-xs text-slate-gray mt-3">
          Every state change (pause, resume, budget increase, reset) is logged as an EU AI Act compliance event.
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ──

function GaugeBar({ label, current, limit, format, exceeded, suffix }: {
  label: string; current: number; limit: number | null; format: (v: number) => string; exceeded?: boolean; suffix?: string;
}) {
  const pct = limit != null && limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
  const color = exceeded ? "bg-red-500" : pct > 80 ? "bg-gold" : "bg-electric-blue";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-gray">{label}</span>
        <span className="text-xs text-white font-medium">
          {format(current)}{limit != null ? ` / ${format(limit)}` : ""}
          {suffix ? ` (${suffix})` : ""}
        </span>
      </div>
      {limit != null && limit > 0 && (
        <div className="w-full bg-navy-mid rounded-full h-2">
          <div className={`${color} rounded-full h-2 transition-all`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function CBEventBadge({ message }: { message: string }) {
  const type = message?.includes("paused") ? "PAUSED" :
    message?.includes("recovered") ? "RECOVERED" :
    message?.includes("retrip") ? "RE-TRIPPED" :
    message?.includes("budget_increased") ? "BUDGET+" :
    message?.includes("reset") ? "RESET" :
    message?.includes("triggered") ? "BLOCKED" : null;
  if (!type) return null;
  const color = type === "RECOVERED" ? "text-green-400 bg-green-900/30 border-green-500/30" :
    type === "PAUSED" ? "text-orange-400 bg-orange-900/30 border-orange-500/30" :
    type === "BUDGET+" ? "text-blue-400 bg-blue-900/30 border-blue-500/30" :
    "text-red-400 bg-red-900/30 border-red-500/30";
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${color}`}>{type}</span>;
}

function ToggleButton({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`shrink-0 w-12 h-6 rounded-full transition-colors relative ${enabled ? "bg-electric-blue" : "bg-navy-light"}`}>
      <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform absolute top-0.5 ${enabled ? "translate-x-6" : "translate-x-0.5"}`} />
    </button>
  );
}
