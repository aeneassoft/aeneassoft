function generateHex(len: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

interface GraphNode {
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
}

interface GraphData {
  nodes: GraphNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type?: string;
    animated?: boolean;
  }>;
}

interface ReadinessScore {
  score: number;
  level: "HIGH" | "MEDIUM" | "LOW";
  checks: Array<{
    name: string;
    earned: number;
    weight: number;
    status: string;
  }>;
}

interface Agent {
  name: string;
  role: string;
  model: string;
  provider: string;
  pt: number;
  ct: number;
  ms: number;
  input: string;
  output: string;
  reasoning?: string;
  flags?: string[];
  status?: string;
}

interface Pipeline {
  name: string;
  description: string;
  agents: Agent[];
  score: number;
  fanOut?: boolean;
}

const PIPELINES: Pipeline[] = [
  {
    name: "EU AI Act Compliance Audit",
    description: "Full compliance pipeline: research regulations, legal analysis, report generation, and validation",
    score: 87,
    fanOut: true,
    agents: [
      { name: "Orchestrator", role: "Coordinator", model: "gpt-4o", provider: "OpenAI", pt: 800, ct: 350, ms: 1800, input: "Conduct EU AI Act compliance audit for customer support AI system.", output: "Plan: Research regulations, analyze system, generate report, validate.", reasoning: "Sequential pipeline — legal analysis depends on research.", flags: ["eu_ai_act_art12_relevant"] },
      { name: "Researcher", role: "Researcher", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 2200, ct: 1800, ms: 3200, input: "Research EU AI Act Articles 12 and 13.", output: "Article 12 requires automatic recording of events. Article 13 requires transparency.", flags: ["eu_ai_act_art12_relevant"] },
      { name: "Legal Analyst", role: "Analyst", model: "gpt-4o", provider: "OpenAI", pt: 3500, ct: 2200, ms: 4100, input: "Analyze system against Article 12 and 13 requirements.", output: "Gap Analysis: Decision logging PARTIAL, Agent transparency PASS, Error docs FAIL.", flags: ["eu_ai_act_art12_relevant"] },
      { name: "Report Writer", role: "Writer", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 4000, ct: 3500, ms: 5200, input: "Write formal EU AI Act compliance report.", output: "System achieves 72% compliance. Two critical gaps identified.", flags: ["eu_ai_act_art12_relevant"] },
      { name: "Validator", role: "Validator", model: "gpt-4o", provider: "OpenAI", pt: 1500, ct: 600, ms: 1400, input: "Validate compliance report.", output: "Validation PASS. Report accurate, recommendations actionable.", flags: ["eu_ai_act_art12_relevant"] },
    ],
  },
  {
    name: "Customer Support Pipeline",
    description: "Automated ticket triage: classification, sentiment analysis, draft response, and QA review",
    score: 62,
    agents: [
      { name: "Ticket Classifier", role: "Classifier", model: "gpt-4o-mini", provider: "OpenAI", pt: 350, ct: 80, ms: 450, input: "Customer: My API stopped working after the update. Getting 401 errors on every request.", output: '{"category":"technical","priority":"P1","sentiment":"frustrated"}', reasoning: "Classified P1 based on production impact." },
      { name: "Sentiment Analyzer", role: "Analyst", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 600, ct: 250, ms: 800, input: "Analyze customer emotional state and urgency.", output: '{"sentiment":-0.7,"tone":"frustrated_but_polite","escalation_risk":"medium"}' },
      { name: "Response Drafter", role: "Writer", model: "gpt-4o", provider: "OpenAI", pt: 1800, ct: 1200, ms: 2400, input: "Draft empathetic response for P1 auth ticket.", output: "Hi, I understand how critical this is. Our v2.3 update changed the auth header format. Here is the fix..." },
      { name: "QA Reviewer", role: "Reviewer", model: "gpt-4o-mini", provider: "OpenAI", pt: 900, ct: 200, ms: 600, input: "Review drafted response for accuracy and tone.", output: '{"approved":true,"tone_score":0.92,"accuracy":1.0,"suggestions":[]}' },
    ],
  },
  {
    name: "Market Research Analysis",
    description: "Multi-provider research: data gathering via Groq, competitor analysis via Mistral, synthesis via GPT-4o",
    score: 55,
    agents: [
      { name: "Research Planner", role: "Coordinator", model: "gpt-4o", provider: "OpenAI", pt: 600, ct: 400, ms: 1100, input: "Plan market analysis for AI Observability sector Q1 2026.", output: "Plan: Gather market data, analyze competitors, identify gaps, write thesis." },
      { name: "Data Gatherer", role: "Researcher", model: "llama3-70b-8192", provider: "Groq", pt: 1500, ct: 2000, ms: 900, input: "Collect AI Observability market size and growth data.", output: "TAM $6.8B by 2029 (CAGR 42%). SAM EU: $1.2B. Current penetration <5%." },
      { name: "Competitor Analyst", role: "Analyst", model: "mistral-large-latest", provider: "Mistral", pt: 2000, ct: 1800, ms: 2200, input: "Analyze Langfuse, Helicone, Arize, LangSmith positioning.", output: "Gap: No competitor offers universal HTTP interception + EU AI Act compliance + FinOps in one SDK." },
      { name: "Synthesizer", role: "Writer", model: "gpt-4o", provider: "OpenAI", pt: 3000, ct: 2500, ms: 3800, input: "Synthesize findings into investment thesis.", output: "Three forces create $6.8B opportunity: EU AI Act mandate, multi-agent adoption, FinOps demand." },
    ],
  },
  {
    name: "Code Review Pipeline",
    description: "Multi-agent code review: static analysis, security scanning, style checks, and summary",
    score: 41,
    fanOut: true,
    agents: [
      { name: "Review Orchestrator", role: "Coordinator", model: "gpt-4o", provider: "OpenAI", pt: 500, ct: 300, ms: 900, input: "Review PR #287: Add authentication middleware.", output: "Dispatching parallel review: static analysis, security scan, style check." },
      { name: "Static Analyzer", role: "Analyzer", model: "gpt-4o", provider: "OpenAI", pt: 4200, ct: 1500, ms: 2800, input: "Static analysis on auth middleware changes.", output: "Issues: Missing null check on req.user (HIGH), JWT secret without env fallback (MEDIUM)." },
      { name: "Security Scanner", role: "SecurityEngineer", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 5000, ct: 2000, ms: 4500, input: "Scan for OWASP Top 10 vulnerabilities.", output: "CRITICAL: SQL injection in auth.ts line 47 — user input passed directly to query template.", status: "ERROR" },
      { name: "Style Checker", role: "Reviewer", model: "gpt-4o-mini", provider: "OpenAI", pt: 3000, ct: 800, ms: 1200, input: "Check code style and conventions.", output: "3 minor issues: inconsistent naming (line 12), missing JSDoc (line 34), magic number (line 67)." },
      { name: "Summary Writer", role: "Writer", model: "gpt-4o", provider: "OpenAI", pt: 2500, ct: 1200, ms: 2000, input: "Aggregate all review findings into PR summary.", output: "PR BLOCKED. 1 CRITICAL security vulnerability (SQL injection). Do NOT merge until resolved.", status: "ERROR" },
    ],
  },
  {
    name: "Content Generation Crew",
    description: "CrewAI-style pipeline: research, write, edit, and SEO optimize a technical blog post",
    score: 70,
    agents: [
      { name: "Crew Lead", role: "Orchestrator", model: "gpt-4o", provider: "OpenAI", pt: 400, ct: 250, ms: 800, input: "Create blog: Why Every Multi-Agent System Needs Observability", output: "Crew plan: Researcher → Writer → Editor → SEO Optimizer. Target: 2000 words." },
      { name: "Content Researcher", role: "Researcher", model: "gemini-1.5-pro", provider: "Gemini", pt: 1200, ct: 1500, ms: 2800, input: "Research and outline blog post structure.", output: "Outline: 1) Multi-agent explosion 2) Observability gap 3) Why APM fails for agents 4) Agent-native approach" },
      { name: "Technical Writer", role: "Writer", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 3000, ct: 4000, ms: 6200, input: "Write 2000-word technical blog post from outline.", output: "# Why Every Multi-Agent System Needs Observability\n\nThe rise of multi-agent AI systems has created..." },
      { name: "Technical Editor", role: "Editor", model: "gpt-4o", provider: "OpenAI", pt: 4500, ct: 4200, ms: 5800, input: "Edit draft for clarity, accuracy, and flow.", output: "Applied 47 changes. Readability improved from Flesch-Kincaid 62 to 78. Removed 3 factual inaccuracies." },
      { name: "SEO Optimizer", role: "Optimizer", model: "gpt-4o-mini", provider: "OpenAI", pt: 1800, ct: 600, ms: 900, input: "Optimize for search engines.", output: '{"primary_keyword":"multi-agent observability","meta_title":"Why Every Multi-Agent System Needs Observability (2026)","estimated_ranking":"top 10"}' },
    ],
  },
  {
    name: "Financial Report Generator",
    description: "Automated quarterly financial report: data extraction, analysis, visualization specs, and narrative",
    score: 78,
    agents: [
      { name: "Data Extractor", role: "DataEngineer", model: "gpt-4o", provider: "OpenAI", pt: 2200, ct: 1800, ms: 3100, input: "Extract Q1 2026 financial data from uploaded CSVs and PDFs.", output: "Extracted: Revenue $2.4M (+34% QoQ), MRR $890K, Churn 2.1%, CAC $1,240, LTV $18,500." },
      { name: "Financial Analyst", role: "Analyst", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 3500, ct: 2800, ms: 4200, input: "Analyze financial trends and key metrics.", output: "Key insight: Unit economics improved 28% due to product-led growth. Burn rate decreased to $180K/mo." },
      { name: "Chart Specifier", role: "Designer", model: "gpt-4o-mini", provider: "OpenAI", pt: 1200, ct: 900, ms: 1400, input: "Generate chart specifications for key metrics.", output: '{"charts":["mrr_trend","cohort_retention","cac_ltv_ratio","revenue_waterfall"],"format":"d3"}' },
      { name: "Narrative Writer", role: "Writer", model: "gpt-4o", provider: "OpenAI", pt: 4000, ct: 5500, ms: 6800, input: "Write executive summary and narrative sections.", output: "Q1 2026 marked a turning point — product-led growth drove 34% revenue increase while reducing CAC by 18%." },
    ],
  },
  {
    name: "Onboarding Flow Optimizer",
    description: "Analyze user onboarding funnel, identify drop-off points, generate A/B test hypotheses",
    score: 58,
    agents: [
      { name: "Funnel Analyzer", role: "Analyst", model: "gpt-4o", provider: "OpenAI", pt: 1800, ct: 1200, ms: 2600, input: "Analyze onboarding funnel data: signup → verify → first_action → retained.", output: "Biggest drop-off: verify → first_action (62% lost). Average time-to-first-action: 4.2 days." },
      { name: "UX Researcher", role: "Researcher", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 2500, ct: 2000, ms: 3400, input: "Identify UX friction points in onboarding flow.", output: "3 friction points: 1) API key setup too complex 2) No quickstart template 3) Dashboard empty state confusing." },
      { name: "Hypothesis Generator", role: "Strategist", model: "gpt-4o", provider: "OpenAI", pt: 1500, ct: 1800, ms: 2100, input: "Generate A/B test hypotheses to reduce drop-off.", output: "Top 3: 1) One-click API key copy (+15% est.) 2) Interactive tutorial (+22% est.) 3) Pre-populated demo data (+18% est.)" },
    ],
  },
  {
    name: "Contract Review Assistant",
    description: "Legal document analysis: clause extraction, risk assessment, and redline suggestions",
    score: 82,
    agents: [
      { name: "Document Parser", role: "Parser", model: "gpt-4o", provider: "OpenAI", pt: 5000, ct: 3000, ms: 4800, input: "Parse 42-page SaaS agreement and extract key clauses.", output: "Extracted 28 key clauses: liability cap, indemnification, data processing, IP ownership, termination." },
      { name: "Risk Assessor", role: "Analyst", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 4000, ct: 3500, ms: 5200, input: "Assess risk level of each extracted clause.", output: "HIGH RISK: Unlimited liability in Section 8.2. MEDIUM: Broad IP assignment in Section 12.1. 3 clauses flagged." },
      { name: "Precedent Checker", role: "Researcher", model: "gpt-4o", provider: "OpenAI", pt: 3000, ct: 2000, ms: 3600, input: "Compare clauses against standard market terms.", output: "Section 8.2 is 3x above market standard liability cap. Section 12.1 IP clause is unusually broad." },
      { name: "Redline Generator", role: "Writer", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 3500, ct: 4500, ms: 5800, input: "Generate redline suggestions with justifications.", output: "12 redlines generated. Priority: Cap liability at 12 months fees, narrow IP to deliverables only." },
    ],
  },
  {
    name: "Incident Response Pipeline",
    description: "Automated incident triage: log analysis, root cause identification, runbook execution, and postmortem draft",
    score: 45,
    agents: [
      { name: "Log Analyzer", role: "SRE", model: "gpt-4o", provider: "OpenAI", pt: 6000, ct: 2500, ms: 3200, input: "Analyze last 500 error logs from production. Alert: 5xx spike at 14:32 UTC.", output: "Pattern: OOM kills on worker-3 and worker-7. Memory usage spike correlates with batch job cron at 14:30." },
      { name: "Root Cause Analyzer", role: "Analyst", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 3500, ct: 2800, ms: 4100, input: "Determine root cause from log analysis.", output: "Root cause: Batch job processes unbounded result set. No pagination on analytics query. Memory grows O(n).", status: "ERROR" },
      { name: "Runbook Executor", role: "Operator", model: "gpt-4o-mini", provider: "OpenAI", pt: 800, ct: 400, ms: 600, input: "Execute mitigation runbook for OOM incident.", output: "Executed: 1) Scaled workers to 8 2) Killed stuck batch job 3) Set memory limit to 4GB. Service recovering." },
      { name: "Postmortem Drafter", role: "Writer", model: "gpt-4o", provider: "OpenAI", pt: 2500, ct: 3000, ms: 4200, input: "Draft incident postmortem.", output: "SEV-2 Incident: Production OOM. Duration: 23 min. Impact: 340 failed requests. Fix: Add pagination to analytics query." },
    ],
  },
  {
    name: "Recruitment Screening Pipeline",
    description: "AI-assisted candidate screening: resume parsing, skill matching, interview question generation",
    score: 66,
    agents: [
      { name: "Resume Parser", role: "Parser", model: "gpt-4o-mini", provider: "OpenAI", pt: 2000, ct: 1500, ms: 1800, input: "Parse resume PDF for senior backend engineer position.", output: '{"experience_years":7,"skills":["Python","Go","Kubernetes","PostgreSQL"],"education":"MS CS Stanford","companies":["Stripe","Datadog"]}' },
      { name: "Skill Matcher", role: "Analyst", model: "gpt-4o", provider: "OpenAI", pt: 1500, ct: 1200, ms: 1600, input: "Match candidate skills against job requirements.", output: '{"match_score":0.87,"strong":["distributed systems","observability"],"gaps":["Rust experience"],"overall":"strong fit"}' },
      { name: "Question Generator", role: "Interviewer", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 1800, ct: 2200, ms: 2800, input: "Generate tailored interview questions based on candidate profile.", output: "5 questions: 1) Describe your work on Datadog's metrics pipeline 2) How would you design a distributed tracing system..." },
    ],
  },
  {
    name: "Product Spec Writer",
    description: "Transform user research into a structured PRD with acceptance criteria and technical constraints",
    score: 72,
    agents: [
      { name: "Research Synthesizer", role: "Researcher", model: "gpt-4o", provider: "OpenAI", pt: 2500, ct: 2000, ms: 3200, input: "Synthesize 12 user interview transcripts about dashboard needs.", output: "Top 3 themes: 1) Real-time cost visibility 2) Alert on anomalous spending 3) Per-agent cost attribution." },
      { name: "PRD Writer", role: "Writer", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 3000, ct: 5000, ms: 6400, input: "Write PRD for Cost Attribution Dashboard feature.", output: "PRD: Cost Attribution Dashboard v1. Goal: Give teams real-time visibility into per-agent LLM spend..." },
      { name: "AC Generator", role: "QA", model: "gpt-4o", provider: "OpenAI", pt: 2000, ct: 1800, ms: 2400, input: "Generate acceptance criteria for each PRD requirement.", output: "12 ACs generated. Example: GIVEN a trace with 5 agents WHEN I view the cost panel THEN I see per-agent cost breakdown." },
      { name: "Tech Constraint Reviewer", role: "Architect", model: "gpt-4o", provider: "OpenAI", pt: 1500, ct: 1200, ms: 1800, input: "Review PRD for technical feasibility and add constraints.", output: "Feasible with current stack. Constraints: ClickHouse aggregation latency <200ms for 30-day windows. Need materialized view." },
    ],
  },
  {
    name: "Data Pipeline Validator",
    description: "Validate ETL pipeline outputs: schema checks, data quality scoring, anomaly detection",
    score: 50,
    agents: [
      { name: "Schema Validator", role: "DataEngineer", model: "gpt-4o-mini", provider: "OpenAI", pt: 1200, ct: 600, ms: 800, input: "Validate output schema of traces ETL pipeline.", output: '{"valid":true,"warnings":["nullable field agent_role in 12% of rows"],"schema_version":"v2.3"}' },
      { name: "Quality Scorer", role: "Analyst", model: "gpt-4o", provider: "OpenAI", pt: 2500, ct: 1500, ms: 2200, input: "Score data quality across 6 dimensions.", output: '{"completeness":0.94,"accuracy":0.98,"timeliness":0.91,"consistency":0.87,"uniqueness":1.0,"validity":0.96}' },
      { name: "Anomaly Detector", role: "Analyst", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 3000, ct: 1800, ms: 3400, input: "Detect anomalies in last 24h trace ingestion.", output: "2 anomalies: 1) Token count spike at 03:00 UTC (3x normal) 2) Missing agent_role in traces from sdk v0.8.1.", status: "ERROR" },
    ],
  },
  {
    name: "Sales Email Sequence",
    description: "Generate personalized outbound email sequence based on prospect research and ICP matching",
    score: 60,
    agents: [
      { name: "Prospect Researcher", role: "Researcher", model: "gpt-4o", provider: "OpenAI", pt: 1800, ct: 1400, ms: 2200, input: "Research prospect: CTO at FinTech startup, Series B, 50 engineers.", output: "Uses LangChain for fraud detection agents. Currently no observability. Raised $28M. Hiring ML engineers." },
      { name: "ICP Matcher", role: "Analyst", model: "gpt-4o-mini", provider: "OpenAI", pt: 600, ct: 300, ms: 500, input: "Score prospect against ideal customer profile.", output: '{"icp_score":0.91,"signals":["multi-agent user","no observability","regulated industry","scaling team"]}' },
      { name: "Email Copywriter", role: "Writer", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 2000, ct: 2500, ms: 3200, input: "Write 3-email outbound sequence personalized to prospect.", output: "Email 1: Subject: 'Your fraud detection agents are flying blind'\nHi Sarah, I noticed you're scaling LangChain agents..." },
      { name: "Compliance Checker", role: "Reviewer", model: "gpt-4o-mini", provider: "OpenAI", pt: 1000, ct: 400, ms: 700, input: "Check emails for GDPR and CAN-SPAM compliance.", output: '{"compliant":true,"notes":["Include unsubscribe link in email 3","Add company address to footer"]}' },
    ],
  },
  {
    name: "Knowledge Base Updater",
    description: "Monitor product changes, update help articles, validate accuracy against codebase",
    score: 74,
    agents: [
      { name: "Changelog Monitor", role: "Monitor", model: "gpt-4o-mini", provider: "OpenAI", pt: 800, ct: 500, ms: 600, input: "Scan last 5 merged PRs for user-facing changes.", output: "3 user-facing changes: 1) New /api/cost/by-model endpoint 2) Renamed dashboard → playground 3) Added PDF export." },
      { name: "Article Identifier", role: "Analyst", model: "gpt-4o", provider: "OpenAI", pt: 1200, ct: 800, ms: 1400, input: "Identify which help articles need updates.", output: "4 articles affected: 'API Reference' (new endpoint), 'Getting Started' (renamed page), 'Exports' (PDF feature)." },
      { name: "Content Updater", role: "Writer", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 3000, ct: 3500, ms: 4600, input: "Rewrite affected sections of help articles.", output: "Updated 4 articles with 12 content changes. Added new section 'PDF Compliance Reports' to Exports guide." },
      { name: "Accuracy Validator", role: "QA", model: "gpt-4o", provider: "OpenAI", pt: 2000, ct: 1000, ms: 1800, input: "Validate updated articles against current API docs and codebase.", output: '{"accuracy":0.98,"issues":["Endpoint path typo in API Reference: /api/cost/by-modal → /api/cost/by-model"]}' },
    ],
  },
  {
    name: "Competitive Intelligence Brief",
    description: "Monitor competitor announcements, analyze positioning changes, generate strategic brief",
    score: 63,
    agents: [
      { name: "News Scanner", role: "Monitor", model: "llama3-70b-8192", provider: "Groq", pt: 1500, ct: 2000, ms: 700, input: "Scan last 7 days for competitor news: Langfuse, Helicone, Arize.", output: "Langfuse raised Series A ($10M). Helicone launched proxy-free mode (beta). Arize added LLM evaluation suite." },
      { name: "Impact Assessor", role: "Analyst", model: "gpt-4o", provider: "OpenAI", pt: 2500, ct: 2000, ms: 3200, input: "Assess competitive impact of each announcement.", output: "HIGH: Helicone proxy-free mode directly competes with our HTTP interception. MEDIUM: Langfuse funding increases sales capacity." },
      { name: "Brief Writer", role: "Writer", model: "claude-sonnet-4-6", provider: "Anthropic", pt: 2000, ct: 3000, ms: 4000, input: "Write strategic competitive intelligence brief.", output: "KEY TAKEAWAY: Helicone's proxy-free beta validates our approach but their implementation requires manual SDK wrapping. Our advantage: automatic HTTP-layer interception requires zero code changes." },
    ],
  },
];

function jitter(value: number): number {
  return Math.round(value * (0.75 + Math.random() * 0.5));
}

function computeCost(pt: number, ct: number, model: string): number {
  const prices: Record<string, [number, number]> = {
    "gpt-4o": [0.0000025, 0.00001],
    "gpt-4o-mini": [0.00000015, 0.0000006],
    "claude-sonnet-4-6": [0.000003, 0.000015],
    "gemini-1.5-pro": [0.00000125, 0.000005],
    "llama3-70b-8192": [0.00000059, 0.00000079],
    "mistral-large-latest": [0.000002, 0.000006],
  };
  const [inP, outP] = prices[model] ?? [0.000003, 0.000015];
  return pt * inP + ct * outP;
}

export function generateLocalSimulation(): {
  traces: Trace[];
  graphs: Record<string, GraphData>;
  scores: Record<string, ReadinessScore>;
} {
  const traces: Trace[] = [];
  const graphs: Record<string, GraphData> = {};
  const scores: Record<string, ReadinessScore> = {};

  // Shuffle and pick 3-5 random pipelines
  const shuffled = [...PIPELINES].sort(() => Math.random() - 0.5);
  const count = 3 + Math.floor(Math.random() * 3);
  const selected = shuffled.slice(0, count);

  for (const pipeline of selected) {
    const traceId = generateHex(16);
    const now = new Date().toISOString();

    let totalTokens = 0;
    let totalCost = 0;
    let maxMs = 0;
    let hasError = false;

    const nodes: GraphNode[] = [];
    const edges: GraphData["edges"] = [];
    const rootId = generateHex(4);

    for (let i = 0; i < pipeline.agents.length; i++) {
      const a = pipeline.agents[i];
      const nodeId = i === 0 ? rootId : generateHex(4);
      const pt = jitter(a.pt);
      const ct = jitter(a.ct);
      const ms = jitter(a.ms);
      const tokens = pt + ct;
      const cost = computeCost(pt, ct, a.model);

      totalTokens += tokens;
      totalCost += cost;
      if (ms > maxMs) maxMs = ms;
      if (a.status === "ERROR") hasError = true;

      nodes.push({
        id: nodeId,
        data: {
          label: a.name,
          agent_name: a.name,
          decision_reasoning: a.reasoning ?? a.input,
          tokens,
          cost_usd: cost,
          status: (a.status ?? "completed").toLowerCase(),
          model: a.model,
        },
        position: { x: 0, y: 0 },
      });

      if (i === 1) {
        edges.push({ id: `e-${rootId}-${nodeId}`, source: rootId, target: nodeId, type: "default" });
      } else if (i > 1) {
        const prevId = nodes[i - 1].id;
        edges.push({ id: `e-${prevId}-${nodeId}`, source: prevId, target: nodeId, type: "causal", animated: true });
      }
    }

    // For fan-out patterns, re-wire: root → all middle children → last
    if (pipeline.fanOut && nodes.length >= 4) {
      edges.length = 0;
      for (let i = 1; i < nodes.length - 1; i++) {
        edges.push({ id: `e-${rootId}-${nodes[i].id}`, source: rootId, target: nodes[i].id, type: "default" });
      }
      const lastNode = nodes[nodes.length - 1];
      for (let i = 1; i < nodes.length - 1; i++) {
        edges.push({ id: `e-${nodes[i].id}-${lastNode.id}`, source: nodes[i].id, target: lastNode.id, type: "causal", animated: true });
      }
    }

    traces.push({
      id: traceId,
      name: pipeline.name,
      description: pipeline.description,
      agent_count: pipeline.agents.length,
      total_tokens: totalTokens,
      total_cost_usd: totalCost,
      duration_ms: maxMs,
      status: hasError ? "error" : "completed",
      created_at: now,
    });

    graphs[traceId] = { nodes, edges };

    const jitteredScore = Math.min(100, Math.max(0, pipeline.score + Math.floor(Math.random() * 21) - 10));
    const jitteredLevel: "HIGH" | "MEDIUM" | "LOW" = jitteredScore >= 75 ? "HIGH" : jitteredScore >= 50 ? "MEDIUM" : "LOW";
    const checkNames = ["Record-Keeping", "Transparency", "Human Oversight", "Data Governance", "Audit Trail"];
    scores[traceId] = {
      score: jitteredScore,
      level: jitteredLevel,
      checks: checkNames.map((name) => {
        const earned = Math.round((jitteredScore / 100) * 20 * (0.7 + Math.random() * 0.6));
        const clamped = Math.min(20, Math.max(0, earned));
        return { name, earned: clamped, weight: 20, status: clamped >= 15 ? "pass" : clamped >= 8 ? "partial" : "fail" };
      }),
    };
  }

  return { traces, graphs, scores };
}
