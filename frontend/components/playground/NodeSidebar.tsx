"use client";

import { X, Cpu, MessageSquare, Coins, DollarSign } from "lucide-react";

interface NodeData {
  label?: string;
  agent_name?: string;
  agentName?: string;
  decision_reasoning?: string;
  input?: string;
  tokens?: number;
  cost_usd?: number;
  cost?: number;
  status?: string;
  span?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    accumulated_cost_usd?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

export function NodeSidebar({
  data,
  onClose,
}: {
  data: NodeData | null;
  onClose: () => void;
}) {
  if (!data) return null;

  const agentName = data.agent_name ?? data.agentName ?? data.label ?? "Agent";
  const reasoning = data.decision_reasoning ?? data.input ?? data.span?.input ?? "";
  const tokens = Number(data.tokens ?? data.span?.prompt_tokens ?? 0) + Number(data.span?.completion_tokens ?? 0);
  const cost = Number(data.cost_usd ?? data.cost ?? data.span?.accumulated_cost_usd ?? 0);
  const status = (data.status ?? "OK").toLowerCase();

  return (
    <div className="glass rounded-xl overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white text-sm">Agent Details</h3>
          <button
            onClick={onClose}
            className="text-slate-gray hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-electric-blue" />
              <span className="text-xs text-slate-gray">Agent Name</span>
            </div>
            <p className="text-sm text-white font-medium">{agentName}</p>
          </div>

          {reasoning && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-electric-blue" />
                <span className="text-xs text-slate-gray">
                  Decision Reasoning
                </span>
              </div>
              <p className="text-sm text-slate-gray leading-relaxed">
                {reasoning}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-deep-navy p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Coins className="w-3 h-3 text-electric-blue" />
                <span className="text-xs text-slate-gray">Tokens</span>
              </div>
              <p className="text-sm font-semibold text-white">
                {(tokens || 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-deep-navy p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3 h-3 text-gold" />
                <span className="text-xs text-slate-gray">Cost</span>
              </div>
              <p className="text-sm font-semibold text-white">
                ${(cost || 0).toFixed(3)}
              </p>
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-gray">Status</span>
            <div className="mt-1">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  status === "error"
                    ? "bg-red-500/10 text-red-400"
                    : status === "completed" || status === "ok"
                    ? "bg-green-500/10 text-green-400"
                    : "bg-slate-gray/10 text-slate-gray"
                }`}
              >
                {data.status ?? "OK"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
