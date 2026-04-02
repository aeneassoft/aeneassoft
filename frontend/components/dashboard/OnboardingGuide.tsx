"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";

interface Props {
  onTraceReceived: () => void;
}

export function OnboardingGuide({ onTraceReceived }: Props) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    fetchAPI<Array<{ id: string; prefix: string }>>("/api/keys")
      .then((keys) => {
        if (keys.length > 0) {
          setApiKey(keys[0].prefix + "...");
        }
      })
      .catch(() => {});
  }, []);

  // Poll for first trace every 5s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const m = await fetchAPI<{ totalTraces: number }>("/api/metrics");
        if (m.totalTraces > 0) {
          clearInterval(interval);
          onTraceReceived();
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [onTraceReceived]);

  function copy(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  const keyDisplay = apiKey || "aw_your_key_here";

  const steps = [
    {
      title: "Install",
      code: "pip install aeneas-agentwatch",
    },
    {
      title: "Set your API Key",
      code: `export AGENTWATCH_API_KEY=${keyDisplay}`,
    },
    {
      title: "Init in your code",
      code: "import agentwatch\nagentwatch.init()",
    },
  ];

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="glass rounded-xl p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white mb-1">
          Get your first trace in 2 minutes
        </h2>
        <p className="text-sm text-slate-gray mb-6">
          Follow these steps to start tracing your AI agents.
        </p>

        <div className="space-y-5">
          {steps.map((step, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-electric-blue mb-2">
                Step {i + 1}: {step.title}
              </p>
              <div className="flex items-start gap-2">
                <pre className="flex-1 bg-navy-mid border border-navy-light rounded-lg px-3 py-2 text-sm text-off-white overflow-x-auto font-mono whitespace-pre">
                  {step.code}
                </pre>
                <button
                  onClick={() => copy(step.code, i)}
                  className="shrink-0 text-xs px-2.5 py-2 rounded bg-navy-mid border border-navy-light text-slate-gray hover:text-white transition-colors"
                >
                  {copied === i ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-electric-blue animate-pulse" />
          <span className="text-sm text-slate-gray">
            Waiting for your first trace... (auto-refreshes every 5s)
          </span>
        </div>
      </div>
    </div>
  );
}
