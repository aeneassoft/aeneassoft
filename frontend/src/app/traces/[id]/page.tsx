'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CausalGraph from '@/components/CausalGraph';

export default function TracePage() {
  const params = useParams();
  const router = useRouter();
  const traceId = params.id as string;
  const [selectedSpan, setSelectedSpan] = useState<any>(null);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <button
          onClick={() => router.push('/')}
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          Dashboard
        </button>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400">Trace</span>
        <span className="text-gray-600">/</span>
        <span className="font-mono text-gray-300">{traceId.substring(0, 12)}...</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Causal Graph</h1>
        <div className="flex gap-2">
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/traces/${traceId}/compliance-report`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg hover:bg-purple-500/30 transition-colors"
          >
            EU AI Act Report (PDF)
          </a>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Graph */}
        <div className={selectedSpan ? 'flex-1' : 'w-full'}>
          <CausalGraph traceId={traceId} onNodeClick={setSelectedSpan} />
        </div>

        {/* Sidebar — Span Details */}
        {selectedSpan && (
          <div className="w-96 bg-gray-900 rounded-lg border border-gray-800 p-4 overflow-auto max-h-[600px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">Span Details</h3>
              <button
                onClick={() => setSelectedSpan(null)}
                className="text-gray-500 hover:text-gray-300"
              >
                x
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-500 text-xs uppercase">Agent</div>
                <div className="text-white">{selectedSpan.agent_name}</div>
                <div className="text-gray-400 text-xs">{selectedSpan.agent_role}</div>
              </div>

              <div>
                <div className="text-gray-500 text-xs uppercase">Operation</div>
                <div className="text-gray-300">{selectedSpan.name}</div>
              </div>

              {selectedSpan.decision_reasoning && (
                <div>
                  <div className="text-gray-500 text-xs uppercase">Decision Reasoning</div>
                  <div className="text-gray-300 text-xs bg-gray-800 p-2 rounded">
                    {selectedSpan.decision_reasoning}
                  </div>
                </div>
              )}

              {selectedSpan.input && (
                <div>
                  <div className="text-gray-500 text-xs uppercase">Input</div>
                  <pre className="text-gray-300 text-xs bg-gray-800 p-2 rounded overflow-auto max-h-40">
                    {typeof selectedSpan.input === 'string'
                      ? selectedSpan.input
                      : JSON.stringify(selectedSpan.input, null, 2)}
                  </pre>
                </div>
              )}

              {selectedSpan.output && (
                <div>
                  <div className="text-gray-500 text-xs uppercase">Output</div>
                  <pre className="text-gray-300 text-xs bg-gray-800 p-2 rounded overflow-auto max-h-40">
                    {typeof selectedSpan.output === 'string'
                      ? selectedSpan.output
                      : JSON.stringify(selectedSpan.output, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <div className="text-gray-500 text-xs uppercase">Model</div>
                <div className="text-gray-300">
                  {selectedSpan.model_inference?.model_name || selectedSpan.model_name || '—'}
                  {(selectedSpan.model_inference?.provider || selectedSpan.provider) && (
                    <span className="text-gray-500 ml-1">
                      ({selectedSpan.model_inference?.provider || selectedSpan.provider})
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-gray-500 text-xs uppercase">Full JSON</div>
                <pre className="text-gray-400 text-xs bg-gray-800 p-2 rounded overflow-auto max-h-60">
                  {JSON.stringify(selectedSpan, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
