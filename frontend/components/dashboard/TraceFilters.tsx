"use client";

import { useState, useEffect } from "react";

interface TraceFiltersProps {
  search: string;
  status: string;
  agentId: string;
  model: string;
  from: string;
  to: string;
  agents: { agent_id: string; agent_name: string }[];
  models: string[];
  onChange: (updates: Record<string, string>) => void;
}

export function TraceFilters({
  search,
  status,
  agentId,
  model,
  from,
  to,
  agents,
  models,
  onChange,
}: TraceFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);

  // Sync from external (URL) changes
  useEffect(() => { setLocalSearch(search); }, [search]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== search) onChange({ search: localSearch });
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  const hasFilters = search || status || agentId || model || from || to;

  const selectClass = "rounded-lg bg-navy-mid border border-navy-light px-2 py-1.5 text-xs text-white focus:outline-none focus:border-electric-blue appearance-none cursor-pointer";
  const inputClass = "rounded-lg bg-navy-mid border border-navy-light px-2 py-1.5 text-xs text-white focus:outline-none focus:border-electric-blue";

  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      {/* Search */}
      <div>
        <label className="block text-[10px] text-slate-gray mb-1">Search</label>
        <input
          type="text"
          placeholder="Trace name..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className={`${inputClass} w-44`}
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-[10px] text-slate-gray mb-1">Status</label>
        <select value={status} onChange={(e) => onChange({ status: e.target.value })} className={selectClass}>
          <option value="">All</option>
          <option value="OK">OK</option>
          <option value="ERROR">ERROR</option>
        </select>
      </div>

      {/* Agent */}
      <div>
        <label className="block text-[10px] text-slate-gray mb-1">Agent</label>
        <select value={agentId} onChange={(e) => onChange({ agent_id: e.target.value })} className={selectClass}>
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
          ))}
        </select>
      </div>

      {/* Model */}
      <div>
        <label className="block text-[10px] text-slate-gray mb-1">Model</label>
        <select value={model} onChange={(e) => onChange({ model: e.target.value })} className={selectClass}>
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Date From */}
      <div>
        <label className="block text-[10px] text-slate-gray mb-1">From</label>
        <input type="date" value={from} onChange={(e) => onChange({ from: e.target.value })} className={inputClass} />
      </div>

      {/* Date To */}
      <div>
        <label className="block text-[10px] text-slate-gray mb-1">To</label>
        <input type="date" value={to} onChange={(e) => onChange({ to: e.target.value })} className={inputClass} />
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => onChange({ search: "", status: "", agent_id: "", model: "", from: "", to: "" })}
          className="text-[10px] text-slate-gray hover:text-white transition-colors py-1.5"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
