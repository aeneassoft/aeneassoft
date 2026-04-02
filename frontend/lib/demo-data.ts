// ── Types (mirrored from playground page) ──────────────────────────────

export interface Trace {
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

export interface GraphData {
  nodes: Array<{
    id: string;
    data: {
      label: string;
      agent_name: string;
      decision_reasoning: string;
      tokens: number;
      cost_usd: number;
      status: string;
      model?: string;
    };
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type?: string;
    animated?: boolean;
  }>;
}

export interface ReadinessScore {
  score: number;
  level: "HIGH" | "MEDIUM" | "LOW";
  details: Record<string, number>;
}

// ── Demo Traces ────────────────────────────────────────────────────────

export const demoTraces: Trace[] = [
  {
    id: "demo-compliance-audit",
    name: "EU AI Act Compliance Audit",
    description:
      "Full compliance pipeline: research regulations, legal analysis, report generation, and validation",
    agent_count: 5,
    total_tokens: 12450,
    total_cost_usd: 0.52,
    duration_ms: 6200,
    status: "completed",
    created_at: "2026-03-28T09:15:00Z",
  },
  {
    id: "demo-support-pipeline",
    name: "Customer Support Pipeline",
    description:
      "Automated ticket triage: classification, sentiment analysis, draft response, and QA review",
    agent_count: 4,
    total_tokens: 8200,
    total_cost_usd: 0.34,
    duration_ms: 3100,
    status: "completed",
    created_at: "2026-03-28T08:42:00Z",
  },
  {
    id: "demo-code-review",
    name: "Code Review Pipeline",
    description:
      "Multi-agent code review: static analysis, security scanning, style checks, and summary",
    agent_count: 5,
    total_tokens: 15800,
    total_cost_usd: 0.71,
    duration_ms: 8700,
    status: "error",
    created_at: "2026-03-28T07:30:00Z",
  },
];

// ── Demo Graphs ────────────────────────────────────────────────────────

export const demoGraphs: Record<string, GraphData> = {
  "demo-compliance-audit": {
    nodes: [
      {
        id: "orch",
        data: {
          label: "Orchestrator",
          agent_name: "Orchestrator Agent",
          decision_reasoning:
            "Receives compliance audit request, decomposes into research → legal analysis → report → validation pipeline. Routes to Researcher first.",
          tokens: 1200,
          cost_usd: 0.05,
          status: "completed",
          model: "gpt-4o",
        },
        position: { x: 0, y: 0 },
      },
      {
        id: "researcher",
        data: {
          label: "Researcher",
          agent_name: "Regulation Researcher",
          decision_reasoning:
            "Queries EU AI Act Articles 12, 13, 52 and cross-references with current system architecture. Identifies 14 applicable requirements.",
          tokens: 3800,
          cost_usd: 0.16,
          status: "completed",
          model: "gpt-4o",
        },
        position: { x: 0, y: 0 },
      },
      {
        id: "legal",
        data: {
          label: "Legal Analyst",
          agent_name: "Legal Analysis Agent",
          decision_reasoning:
            "Evaluates each requirement against system capabilities. Flags 2 gaps in transparency logging and 1 gap in human oversight documentation.",
          tokens: 3200,
          cost_usd: 0.13,
          status: "completed",
          model: "claude-sonnet-4-6",
        },
        position: { x: 0, y: 0 },
      },
      {
        id: "writer",
        data: {
          label: "Report Writer",
          agent_name: "Compliance Report Writer",
          decision_reasoning:
            "Generates structured compliance report with pass/fail checklist, risk scores, and remediation recommendations for each article.",
          tokens: 2800,
          cost_usd: 0.12,
          status: "completed",
          model: "gpt-4o",
        },
        position: { x: 0, y: 0 },
      },
      {
        id: "validator",
        data: {
          label: "Validator",
          agent_name: "Report Validator",
          decision_reasoning:
            "Cross-checks report against original requirements. Confirms 87% compliance score. No factual errors found. Report approved.",
          tokens: 1450,
          cost_usd: 0.06,
          status: "completed",
          model: "gpt-4o",
        },
        position: { x: 0, y: 0 },
      },
    ],
    edges: [
      { id: "e1", source: "orch", target: "researcher", type: "default" },
      {
        id: "e2",
        source: "researcher",
        target: "legal",
        type: "causal",
        animated: true,
      },
      {
        id: "e3",
        source: "legal",
        target: "writer",
        type: "causal",
        animated: true,
      },
      {
        id: "e4",
        source: "writer",
        target: "validator",
        type: "causal",
        animated: true,
      },
    ],
  },

  "demo-support-pipeline": {
    nodes: [
      {
        id: "classifier",
        data: {
          label: "Ticket Classifier",
          agent_name: "Ticket Classifier",
          decision_reasoning:
            "Analyzes incoming ticket: 'Payment not processing after upgrade'. Classified as: category=billing, priority=high, requires_escalation=false.",
          tokens: 1800,
          cost_usd: 0.07,
          status: "completed",
          model: "gpt-4o",
        },
        position: { x: 0, y: 0 },
      },
      {
        id: "sentiment",
        data: {
          label: "Sentiment Analyzer",
          agent_name: "Sentiment Analysis Agent",
          decision_reasoning:
            "Customer tone: frustrated but polite. Sentiment score: -0.6 (negative). Urgency indicators detected. Recommending empathetic response template.",
          tokens: 1200,
          cost_usd: 0.05,
          status: "completed",
          model: "claude-sonnet-4-6",
        },
        position: { x: 0, y: 0 },
      },
      {
        id: "drafter",
        data: {
          label: "Response Drafter",
          agent_name: "Response Drafter Agent",
          decision_reasoning:
            "Drafting response using empathetic billing template. Including: apology, explanation of billing cycle change, immediate resolution steps, and follow-up timeline.",
          tokens: 3200,
          cost_usd: 0.13,
          status: "completed",
          model: "gpt-4o",
        },
        position: { x: 0, y: 0 },
      },
      {
        id: "qa",
        data: {
          label: "QA Reviewer",
          agent_name: "Quality Assurance Reviewer",
          decision_reasoning:
            "Reviewed draft response. Tone: appropriate. Accuracy: verified against billing docs. Policy compliance: OK. Grammar: clean. Approved for sending.",
          tokens: 2000,
          cost_usd: 0.09,
          status: "completed",
          model: "claude-sonnet-4-6",
        },
        position: { x: 0, y: 0 },
      },
    ],
    edges: [
      {
        id: "e1",
        source: "classifier",
        target: "sentiment",
        type: "default",
      },
      {
        id: "e2",
        source: "classifier",
        target: "drafter",
        type: "default",
      },
      {
        id: "e3",
        source: "sentiment",
        target: "drafter",
        type: "causal",
        animated: true,
      },
      {
        id: "e4",
        source: "drafter",
        target: "qa",
        type: "causal",
        animated: true,
      },
    ],
  },

  "demo-code-review": {
    nodes: [
      {
        id: "orch",
        data: {
          label: "Orchestrator",
          agent_name: "Review Orchestrator",
          decision_reasoning:
            "Received PR #247: 'Add user authentication middleware'. 14 files changed. Dispatching to static analysis, security scan, and style check in parallel.",
          tokens: 1500,
          cost_usd: 0.06,
          status: "completed",
          model: "gpt-4o",
        },
        position: { x: 0, y: 0 },
      },
      {
        id: "static",
        data: {
          label: "Static Analyzer",
          agent_name: "Static Analysis Agent",
          decision_reasoning:
            "Found 3 issues: unused import (auth/types.ts:12), missing null check (middleware.ts:45), potential memory leak in session handler (session.ts:78). Severity: 1 high, 2 medium.",
          tokens: 4200,
          cost_usd: 0.18,
          status: "completed",
          model: "gpt-4o",
        },
        position: { x: 0, y: 0 },
      },
      {
        id: "security",
        data: {
          label: "Security Scanner",
          agent_name: "Security Scan Agent",
          decision_reasoning:
            "CRITICAL: SQL injection vulnerability detected in auth/login.ts:34 — user input passed directly to query template. Additionally: JWT secret hardcoded in config.ts:8.",
          tokens: 3800,
          cost_usd: 0.16,
          status: "error",
          model: "claude-sonnet-4-6",
        },
        position: { x: 0, y: 0 },
      },
      {
        id: "style",
        data: {
          label: "Style Checker",
          agent_name: "Code Style Agent",
          decision_reasoning:
            "12 style violations found: 4 inconsistent naming conventions, 3 missing JSDoc comments on public methods, 5 lines exceeding 120 char limit. Auto-fixable: 8/12.",
          tokens: 2800,
          cost_usd: 0.12,
          status: "completed",
          model: "gpt-4o",
        },
        position: { x: 0, y: 0 },
      },
      {
        id: "summary",
        data: {
          label: "Summary Writer",
          agent_name: "Review Summary Agent",
          decision_reasoning:
            "Consolidating findings. BLOCKING: 1 critical security vulnerability (SQL injection). PR cannot be merged until security issues are resolved. Generated inline review comments.",
          tokens: 3500,
          cost_usd: 0.19,
          status: "completed",
          model: "gpt-4o",
        },
        position: { x: 0, y: 0 },
      },
    ],
    edges: [
      { id: "e1", source: "orch", target: "static", type: "default" },
      { id: "e2", source: "orch", target: "security", type: "default" },
      { id: "e3", source: "orch", target: "style", type: "default" },
      {
        id: "e4",
        source: "static",
        target: "summary",
        type: "causal",
        animated: true,
      },
      {
        id: "e5",
        source: "security",
        target: "summary",
        type: "causal",
        animated: true,
      },
      {
        id: "e6",
        source: "style",
        target: "summary",
        type: "causal",
        animated: true,
      },
    ],
  },
};

// ── Demo Readiness Scores ──────────────────────────────────────────────

export const demoScores: Record<string, ReadinessScore> = {
  "demo-compliance-audit": {
    score: 87,
    level: "HIGH",
    details: {
      traceability: 95,
      logging: 90,
      auditability: 82,
      data_retention: 88,
      human_oversight: 80,
    },
  },
  "demo-support-pipeline": {
    score: 62,
    level: "MEDIUM",
    details: {
      traceability: 75,
      logging: 68,
      auditability: 55,
      data_retention: 60,
      human_oversight: 50,
    },
  },
  "demo-code-review": {
    score: 41,
    level: "LOW",
    details: {
      traceability: 55,
      logging: 40,
      auditability: 35,
      data_retention: 45,
      human_oversight: 30,
    },
  },
};
