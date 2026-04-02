export const fallbackTraces = [
  {
    id: "trace-001",
    name: "Market Research Agent",
    description: "Multi-agent pipeline: research, analyze, and generate report",
    agent_count: 4,
    total_tokens: 12847,
    total_cost_usd: 0.38,
    duration_ms: 4521,
    status: "completed",
    created_at: "2026-03-27T14:30:00Z",
  },
  {
    id: "trace-002",
    name: "Customer Support Bot",
    description: "Ticket classification, sentiment analysis, and auto-response",
    agent_count: 3,
    total_tokens: 8234,
    total_cost_usd: 0.24,
    duration_ms: 2103,
    status: "completed",
    created_at: "2026-03-27T13:15:00Z",
  },
  {
    id: "trace-003",
    name: "Code Review Pipeline",
    description: "Static analysis, security scan, and review summary generation",
    agent_count: 5,
    total_tokens: 21503,
    total_cost_usd: 0.64,
    duration_ms: 8732,
    status: "error",
    created_at: "2026-03-27T12:00:00Z",
  },
];

export const fallbackGraph = {
  nodes: [
    { id: "orchestrator", data: { label: "Orchestrator", agent_name: "Orchestrator Agent", decision_reasoning: "Routes incoming request to appropriate sub-agents", tokens: 1250, cost_usd: 0.04, status: "completed" }, position: { x: 0, y: 0 } },
    { id: "researcher", data: { label: "Researcher", agent_name: "Research Agent", decision_reasoning: "Queries external APIs for market data and competitor analysis", tokens: 4521, cost_usd: 0.14, status: "completed" }, position: { x: 0, y: 0 } },
    { id: "analyzer", data: { label: "Analyzer", agent_name: "Analysis Agent", decision_reasoning: "Processes raw data into structured insights with statistical analysis", tokens: 3876, cost_usd: 0.12, status: "completed" }, position: { x: 0, y: 0 } },
    { id: "writer", data: { label: "Report Writer", agent_name: "Writer Agent", decision_reasoning: "Generates final report from analyzed data", tokens: 3200, cost_usd: 0.10, status: "completed" }, position: { x: 0, y: 0 } },
  ],
  edges: [
    { id: "e1", source: "orchestrator", target: "researcher", type: "default" },
    { id: "e2", source: "orchestrator", target: "analyzer", type: "default" },
    { id: "e3", source: "researcher", target: "analyzer", type: "causal", animated: true },
    { id: "e4", source: "analyzer", target: "writer", type: "causal", animated: true },
  ],
};

export const fallbackReadinessScore = {
  score: 72,
  level: "MEDIUM" as const,
  details: {
    traceability: 85,
    logging: 70,
    auditability: 60,
    data_retention: 75,
  },
};
