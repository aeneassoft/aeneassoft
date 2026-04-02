"use client";

import { useState } from "react";
import { Clock, Cpu, DollarSign, AlertCircle, ChevronDown } from "lucide-react";

interface Trace {
  id: string;
  name: string;
  description: string;
  agent_count: number;
  total_tokens: number;
  total_cost_usd: number;
  duration_ms: number;
  status: string;
  created_at: string;
}

export function TraceCard({
  trace,
  selected,
  onClick,
}: {
  trace: Trace;
  selected: boolean;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isError = (trace.status ?? "").toLowerCase() === "error";

  function handleClick() {
    onClick();
    if (selected) {
      setExpanded((prev) => !prev);
    } else {
      setExpanded(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left rounded-lg p-4 border transition-all ${
        selected
          ? "border-electric-blue bg-electric-blue/10"
          : "border-navy-light bg-navy-mid hover:border-slate-gray/30"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-white text-sm">{trace.name ?? "Unnamed"}</h3>
        <div className="flex items-center gap-1 shrink-0">
          {isError && <AlertCircle className="w-4 h-4 text-red-400" />}
          {selected && (
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-gray transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          )}
        </div>
      </div>
      <p
        className={`text-xs text-slate-gray mb-3 ${
          selected && expanded ? "" : "line-clamp-2"
        }`}
      >
        {trace.description ?? ""}
      </p>
      <div className="flex items-center gap-3 text-xs text-slate-gray">
        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3" />
          {trace.agent_count ?? 0} agents
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" />${(trace.total_cost_usd ?? 0).toFixed(2)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {((trace.duration_ms ?? 0) / 1000).toFixed(1)}s
        </span>
      </div>
    </button>
  );
}
