"""
AeneasSoft — Simulates 5 realistic multi-agent pipelines
Sends ATP spans directly to the production API via HTTPS.
No real LLM calls — all data is realistic but synthetic.

Usage:
    python simulate_agents.py
    # or with custom endpoint:
    API_URL=https://api.aeneassoft.com API_KEY=your_key python simulate_agents.py
"""
import os
import time
import uuid
import json
import httpx
import random
from typing import List, Dict, Optional

API_URL = os.environ.get("API_URL", "https://api.aeneassoft.com")
API_KEY = os.environ.get("API_KEY", os.environ.get("AGENTWATCH_API_KEY", ""))

HEADERS = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
}


def hex32() -> str:
    return uuid.uuid4().hex


def hex16() -> str:
    return uuid.uuid4().hex[:16]


def now_ns() -> int:
    return int(time.time() * 1e9)


def send_span(span: dict) -> bool:
    try:
        r = httpx.post(f"{API_URL}/api/ingest", json=span, headers=HEADERS, timeout=5.0)
        if r.status_code == 202:
            return True
        print(f"  WARN: {r.status_code} — {r.text[:100]}")
        return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def make_span(
    trace_id: str,
    name: str,
    agent_id: str,
    agent_name: str,
    agent_role: str,
    parent_span_id: Optional[str] = None,
    model: str = "gpt-4o",
    provider: str = "OpenAI",
    prompt_tokens: int = 500,
    completion_tokens: int = 200,
    latency_ms: int = 1200,
    status: str = "OK",
    status_message: Optional[str] = None,
    input_text: Optional[str] = None,
    output_text: Optional[str] = None,
    decision_reasoning: Optional[str] = None,
    compliance_flags: Optional[List[str]] = None,
    task_id: Optional[str] = None,
    cost_usd: Optional[float] = None,
    links: Optional[List[Dict]] = None,
) -> dict:
    start = now_ns() - int(latency_ms * 1e6)
    end = now_ns()

    span = {
        "trace_id": trace_id,
        "span_id": hex16(),
        "name": name,
        "kind": "CLIENT",
        "start_time_unix_nano": start,
        "end_time_unix_nano": end,
        "status": {"code": status},
        "agent_id": agent_id,
        "agent_name": agent_name,
        "agent_role": agent_role,
        "model_inference": {
            "model_name": model,
            "provider": provider,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "latency_ms": latency_ms,
        },
    }

    if parent_span_id:
        span["parent_span_id"] = parent_span_id
    if status_message:
        span["status"]["message"] = status_message
    if input_text:
        span["input"] = input_text
    if output_text:
        span["output"] = output_text
    if decision_reasoning:
        span["decision_reasoning"] = decision_reasoning
    if compliance_flags:
        span["compliance_flags"] = compliance_flags
    if task_id or cost_usd:
        span["cost_attribution"] = {}
        if task_id:
            span["cost_attribution"]["task_id"] = task_id
        if cost_usd:
            span["cost_attribution"]["accumulated_cost_usd"] = cost_usd
    if links:
        span["links"] = links

    return span


# ═══════════════════════════════════════════════════════════════════════════════
# PIPELINE 1: EU AI Act Compliance Audit
# ═══════════════════════════════════════════════════════════════════════════════
def pipeline_eu_compliance():
    print("\n[1/5] EU AI Act Compliance Audit Pipeline")
    trace_id = hex32()
    task = "eu-audit-001"

    # Orchestrator (root)
    orch = make_span(
        trace_id, "orchestrator.plan", "orch-eu", "Orchestrator", "Coordinator",
        model="gpt-4o", provider="OpenAI",
        prompt_tokens=800, completion_tokens=350, latency_ms=1800,
        input_text="Conduct a comprehensive EU AI Act compliance audit for the customer support AI system.",
        output_text="Plan: 1) Research current regulations 2) Analyze system against Art. 12 requirements 3) Generate legal analysis 4) Write compliance report 5) Validate findings",
        decision_reasoning="Selected sequential pipeline because legal analysis depends on research findings. Assigned Legal Analyst for Art. 12/13 interpretation.",
        compliance_flags=["eu_ai_act_art12_relevant"],
        task_id=task, cost_usd=0.042,
    )

    # Researcher
    researcher = make_span(
        trace_id, "researcher.search", "research-eu", "EU Regulation Researcher", "Researcher",
        parent_span_id=orch["span_id"],
        model="claude-sonnet-4-6", provider="Anthropic",
        prompt_tokens=2200, completion_tokens=1800, latency_ms=3200,
        input_text="Research EU AI Act Articles 12 and 13 requirements. Focus on logging, transparency, and record-keeping obligations for AI systems classified as high-risk.",
        output_text="Article 12 requires: automatic recording of events (logs), traceability of decisions, ability to monitor operation. Article 13 requires: transparency about AI system capabilities, limitations, intended purpose. High-risk AI systems must maintain logs for at least 6 months.",
        decision_reasoning="Used Anthropic Claude for regulatory research due to superior accuracy on legal texts. Cross-referenced with EUR-Lex database.",
        compliance_flags=["eu_ai_act_art12_relevant"],
        task_id=task, cost_usd=0.14,
    )

    # Legal Analyst
    legal = make_span(
        trace_id, "legal.analyze", "legal-eu", "Legal Analyst", "Analyst",
        parent_span_id=orch["span_id"],
        model="gpt-4o", provider="OpenAI",
        prompt_tokens=3500, completion_tokens=2200, latency_ms=4100,
        input_text="Based on the research findings, analyze our customer support AI system against EU AI Act Article 12 and 13 requirements. Identify gaps and compliance risks.",
        output_text="Gap Analysis: 1) Decision logging: PARTIAL — logs exist but lack reasoning fields. 2) Agent transparency: PASS — all agents identified with roles. 3) Cost tracking: PASS — per-task attribution active. 4) Error documentation: FAIL — error spans missing status messages. Recommendation: Add decision_reasoning to all orchestrator spans.",
        decision_reasoning="Performed gap analysis against 7-point compliance checklist. Identified 2 critical gaps requiring immediate remediation.",
        compliance_flags=["eu_ai_act_art12_relevant"],
        task_id=task, cost_usd=0.22,
    )

    # Report Writer
    writer = make_span(
        trace_id, "writer.report", "writer-eu", "Report Writer", "Writer",
        parent_span_id=orch["span_id"],
        model="claude-sonnet-4-6", provider="Anthropic",
        prompt_tokens=4000, completion_tokens=3500, latency_ms=5200,
        input_text="Write a formal EU AI Act compliance report based on the legal analysis. Include Article 12 and 13 assessment, gap analysis, and remediation recommendations.",
        output_text="EU AI Act Compliance Report — Executive Summary: The system achieves 72% compliance with Articles 12-13. Two critical gaps identified: (1) Decision reasoning not consistently logged, (2) Error spans lack descriptive messages. Recommended actions: Enable decision_reasoning field on all orchestrator spans, implement status_message for ERROR spans.",
        compliance_flags=["eu_ai_act_art12_relevant"],
        task_id=task, cost_usd=0.28,
    )

    # Validator
    validator = make_span(
        trace_id, "validator.check", "validator-eu", "Compliance Validator", "Validator",
        parent_span_id=orch["span_id"],
        model="gpt-4o", provider="OpenAI",
        prompt_tokens=1500, completion_tokens=600, latency_ms=1400,
        input_text="Validate the compliance report for accuracy, completeness, and legal correctness.",
        output_text="Validation: PASS. Report accurately reflects system state. Score calculation verified. Remediation recommendations are actionable and prioritized correctly.",
        decision_reasoning="Cross-checked report claims against actual span data. All statistics verified.",
        compliance_flags=["eu_ai_act_art12_relevant"],
        task_id=task, cost_usd=0.06,
    )

    for s in [orch, researcher, legal, writer, validator]:
        ok = send_span(s)
        print(f"  {'OK' if ok else 'FAIL'} {s['agent_name']}: {s['name']}")
        time.sleep(0.1)

    return trace_id


# ═══════════════════════════════════════════════════════════════════════════════
# PIPELINE 2: Customer Support Ticket Resolution
# ═══════════════════════════════════════════════════════════════════════════════
def pipeline_customer_support():
    print("\n[2/5] Customer Support Ticket Resolution Pipeline")
    trace_id = hex32()
    task = "support-ticket-4821"

    classifier = make_span(
        trace_id, "classifier.categorize", "cls-support", "Ticket Classifier", "Classifier",
        model="gpt-4o-mini", provider="OpenAI",
        prompt_tokens=350, completion_tokens=80, latency_ms=450,
        input_text="Customer ticket: 'My API integration stopped working after your last update. Getting 401 errors on all endpoints. This is blocking our production deployment. URGENT.'",
        output_text='{"category": "technical_issue", "priority": "P1", "sentiment": "frustrated", "topic": "api_authentication"}',
        decision_reasoning="Classified as P1 technical issue based on: production impact mentioned, authentication error pattern, urgency language.",
        task_id=task, cost_usd=0.001,
    )

    sentiment = make_span(
        trace_id, "sentiment.analyze", "sent-support", "Sentiment Analyzer", "Analyst",
        parent_span_id=classifier["span_id"],
        model="claude-sonnet-4-6", provider="Anthropic",
        prompt_tokens=600, completion_tokens=250, latency_ms=800,
        input_text="Analyze customer sentiment and emotional state for personalized response calibration.",
        output_text='{"overall_sentiment": -0.7, "emotions": ["frustration", "urgency", "concern"], "tone_recommendation": "empathetic_professional", "escalation_risk": "medium"}',
        decision_reasoning="High frustration detected. Recommended empathetic tone with immediate technical resolution focus.",
        task_id=task, cost_usd=0.008,
    )

    drafter = make_span(
        trace_id, "drafter.compose", "draft-support", "Response Drafter", "Writer",
        parent_span_id=classifier["span_id"],
        model="gpt-4o", provider="OpenAI",
        prompt_tokens=1800, completion_tokens=1200, latency_ms=2400,
        input_text="Draft a response for P1 technical ticket about 401 API errors. Use empathetic_professional tone. Include troubleshooting steps.",
        output_text="Hi [Customer], I understand how critical this is for your production deployment, and I apologize for the disruption. Our latest update changed the authentication header format from X-Custom-Key to X-API-Key. Here's how to fix it immediately: 1) Update your header name to 'X-API-Key' 2) Regenerate your API key at dashboard.example.com/keys 3) Test with: curl -H 'X-API-Key: your-key' api.example.com/health. This should resolve the 401 errors instantly. I'm monitoring this ticket personally.",
        decision_reasoning="Combined technical resolution with empathetic tone. Included concrete fix steps to reduce back-and-forth.",
        task_id=task, cost_usd=0.032,
    )

    qa = make_span(
        trace_id, "qa.review", "qa-support", "QA Reviewer", "Reviewer",
        parent_span_id=classifier["span_id"],
        model="gpt-4o-mini", provider="OpenAI",
        prompt_tokens=900, completion_tokens=200, latency_ms=600,
        input_text="Review drafted response for technical accuracy, tone appropriateness, and completeness.",
        output_text='{"approved": true, "tone_score": 0.92, "technical_accuracy": 1.0, "completeness": 0.95, "suggested_additions": ["Add link to migration guide"]}',
        task_id=task, cost_usd=0.002,
    )

    for s in [classifier, sentiment, drafter, qa]:
        ok = send_span(s)
        print(f"  {'OK' if ok else 'FAIL'} {s['agent_name']}: {s['name']}")
        time.sleep(0.1)

    return trace_id


# ═══════════════════════════════════════════════════════════════════════════════
# PIPELINE 3: Market Research & Analysis
# ═══════════════════════════════════════════════════════════════════════════════
def pipeline_market_research():
    print("\n[3/5] Market Research & Analysis Pipeline")
    trace_id = hex32()
    task = "market-q1-2026"

    planner = make_span(
        trace_id, "planner.strategize", "plan-market", "Research Planner", "Coordinator",
        model="gpt-4o", provider="OpenAI",
        prompt_tokens=600, completion_tokens=400, latency_ms=1100,
        input_text="Plan a comprehensive market analysis for the AI Observability sector Q1 2026.",
        output_text="Research plan: 1) Gather market size data from analyst reports 2) Analyze competitor landscape (Langfuse, Helicone, Arize) 3) Identify market gaps 4) Generate investment thesis",
        decision_reasoning="Chose parallel execution for data gathering (steps 1-2) and sequential for analysis (steps 3-4) to optimize latency.",
        task_id=task, cost_usd=0.018,
    )

    data_gatherer = make_span(
        trace_id, "gatherer.collect", "gather-market", "Data Gatherer", "Researcher",
        parent_span_id=planner["span_id"],
        model="llama3-70b-8192", provider="Groq",
        prompt_tokens=1500, completion_tokens=2000, latency_ms=900,
        input_text="Collect market size data for AI/LLM Observability market. Include TAM, SAM, growth projections.",
        output_text="Market Data: TAM $6.8B by 2029 (CAGR 36%). SAM (EU enterprise): $1.2B. Current penetration: <5%. Key drivers: EU AI Act compliance (Dec 2027 deadline), multi-agent adoption (40% enterprise by 2026), cost optimization pressure ($8k/month average LLM spend per team).",
        task_id=task, cost_usd=0.004,
    )

    competitor = make_span(
        trace_id, "competitor.analyze", "comp-market", "Competitor Analyst", "Analyst",
        parent_span_id=planner["span_id"],
        model="mistral-large-latest", provider="Mistral",
        prompt_tokens=2000, completion_tokens=1800, latency_ms=2200,
        input_text="Analyze competitive landscape: Langfuse (acquired by ClickHouse), Helicone, Arize AI, LangSmith. Focus on positioning gaps.",
        output_text="Competitor Analysis: Langfuse — acquired by ClickHouse, strong OSS community but pivoting to database-first. Helicone — proxy-only, single point of failure. Arize — ML monitoring, weak on agent tracing. LangSmith — LangChain-only, vendor lock-in. GAP: No competitor offers universal HTTP-layer interception + EU AI Act compliance + FinOps in one product.",
        decision_reasoning="Used Mistral for competitive analysis to diversify provider usage and benchmark response quality.",
        task_id=task, cost_usd=0.024,
    )

    synthesizer = make_span(
        trace_id, "synthesizer.conclude", "synth-market", "Research Synthesizer", "Writer",
        parent_span_id=planner["span_id"],
        model="gpt-4o", provider="OpenAI",
        prompt_tokens=3000, completion_tokens=2500, latency_ms=3800,
        input_text="Synthesize market data and competitive analysis into an investment thesis.",
        output_text="Investment Thesis: The AI Observability market is at an inflection point. Three converging forces create a $6.8B opportunity: (1) EU AI Act compliance deadline Dec 2027 creates mandatory demand, (2) Multi-agent systems require purpose-built observability, (3) Enterprise LLM costs averaging $8k/month demand FinOps tools. AeneasSoft is uniquely positioned with the only product combining universal HTTP interception, EU AI Act compliance, and real-time cost attribution.",
        decision_reasoning="Synthesized quantitative market data with qualitative competitive analysis. Thesis structured around the three strongest market drivers.",
        task_id=task, cost_usd=0.065,
    )

    for s in [planner, data_gatherer, competitor, synthesizer]:
        ok = send_span(s)
        print(f"  {'OK' if ok else 'FAIL'} {s['agent_name']}: {s['name']}")
        time.sleep(0.1)

    return trace_id


# ═══════════════════════════════════════════════════════════════════════════════
# PIPELINE 4: Code Review & Security Scan (with ERROR)
# ═══════════════════════════════════════════════════════════════════════════════
def pipeline_code_review():
    print("\n[4/5] Code Review & Security Scan Pipeline (includes ERROR)")
    trace_id = hex32()
    task = "pr-review-287"

    orchestrator = make_span(
        trace_id, "orchestrator.dispatch", "orch-review", "Review Orchestrator", "Coordinator",
        model="gpt-4o", provider="OpenAI",
        prompt_tokens=500, completion_tokens=300, latency_ms=900,
        input_text="Review PR #287: Add user authentication middleware to backend API.",
        output_text="Dispatching 3 parallel reviews: static analysis, security scan, style check. Will aggregate results for final summary.",
        decision_reasoning="Parallel execution chosen — each reviewer is independent. Security scan flagged as critical path.",
        task_id=task, cost_usd=0.012,
    )

    static_analyzer = make_span(
        trace_id, "static.analyze", "static-review", "Static Analyzer", "Analyzer",
        parent_span_id=orchestrator["span_id"],
        model="gpt-4o", provider="OpenAI",
        prompt_tokens=4200, completion_tokens=1500, latency_ms=2800,
        input_text="Perform static analysis on auth middleware changes. Check for type safety, null handling, error boundaries.",
        output_text="Static Analysis: 12 files changed, 340 lines added. Issues found: (1) Missing null check on request.headers['authorization'] — potential crash. (2) JWT secret loaded from env without fallback — server won't start if missing. (3) Token expiry check uses Date.now() without timezone consideration. Severity: 1 HIGH, 2 MEDIUM.",
        task_id=task, cost_usd=0.058,
    )

    security_scanner = make_span(
        trace_id, "security.scan", "sec-review", "Security Scanner", "SecurityEngineer",
        parent_span_id=orchestrator["span_id"],
        model="claude-sonnet-4-6", provider="Anthropic",
        prompt_tokens=5000, completion_tokens=2000, latency_ms=4500,
        status="ERROR",
        status_message="CRITICAL: SQL injection vulnerability detected in user lookup query. String interpolation used instead of parameterized query on line 47 of auth.ts.",
        input_text="Scan auth middleware for OWASP Top 10 vulnerabilities. Focus on injection, broken auth, sensitive data exposure.",
        output_text="CRITICAL VULNERABILITY FOUND: auth.ts:47 uses string interpolation for SQL query: `WHERE username = '${req.body.username}'`. This is a textbook SQL injection vector. MUST use parameterized queries. Additional findings: (1) API key logged in plaintext at DEBUG level, (2) No rate limiting on login endpoint, (3) Session token stored in localStorage instead of httpOnly cookie.",
        decision_reasoning="Flagged as CRITICAL — SQL injection in authentication path allows complete auth bypass. PR must NOT be merged until fixed.",
        task_id=task, cost_usd=0.082,
    )

    style_checker = make_span(
        trace_id, "style.check", "style-review", "Style Checker", "Reviewer",
        parent_span_id=orchestrator["span_id"],
        model="gpt-4o-mini", provider="OpenAI",
        prompt_tokens=3000, completion_tokens=800, latency_ms=1200,
        input_text="Check code style, naming conventions, and documentation completeness.",
        output_text="Style Review: 3 issues found. (1) Inconsistent naming: 'authMiddleware' vs 'AuthMiddleware' — pick one. (2) Missing JSDoc on 3 exported functions. (3) Magic number 3600 should be AUTH_TOKEN_EXPIRY_SECONDS constant. All minor.",
        task_id=task, cost_usd=0.008,
    )

    summary_writer = make_span(
        trace_id, "summary.aggregate", "summary-review", "Review Summarizer", "Writer",
        parent_span_id=orchestrator["span_id"],
        model="gpt-4o", provider="OpenAI",
        prompt_tokens=2500, completion_tokens=1200, latency_ms=2000,
        status="ERROR",
        status_message="Review blocked due to CRITICAL security finding. PR cannot be approved.",
        input_text="Aggregate all review findings into a final PR review summary.",
        output_text="PR #287 REVIEW: BLOCKED. CRITICAL: SQL injection in auth.ts:47 (Security Scanner). HIGH: Missing null check on authorization header (Static Analyzer). 2 MEDIUM + 3 MINOR issues. Action required: Fix SQL injection before any other changes. Do NOT merge.",
        decision_reasoning="Escalated to BLOCKED status because security scanner found a CRITICAL vulnerability. No review can pass with an active SQL injection.",
        task_id=task, cost_usd=0.038,
    )

    for s in [orchestrator, static_analyzer, security_scanner, style_checker, summary_writer]:
        ok = send_span(s)
        print(f"  {'OK' if ok else 'FAIL'} {s['agent_name']}: {s['name']}")
        time.sleep(0.1)

    return trace_id


# ═══════════════════════════════════════════════════════════════════════════════
# PIPELINE 5: Content Generation Crew (CrewAI-style)
# ═══════════════════════════════════════════════════════════════════════════════
def pipeline_content_crew():
    print("\n[5/5] Content Generation Crew Pipeline")
    trace_id = hex32()
    task = "blog-ai-observability"

    crew_lead = make_span(
        trace_id, "crew.kickoff", "lead-content", "Crew Lead", "Orchestrator",
        model="gpt-4o", provider="OpenAI",
        prompt_tokens=400, completion_tokens=250, latency_ms=800,
        input_text="Create a technical blog post: 'Why Every Multi-Agent System Needs Observability'",
        output_text="Crew assembled: Researcher → Writer → Editor → SEO Optimizer. Target: 2000 words, technical audience, include code examples.",
        decision_reasoning="Sequential pipeline — each step builds on the previous. Researcher informs Writer, Editor polishes, SEO optimizes.",
        task_id=task, cost_usd=0.01,
    )

    researcher = make_span(
        trace_id, "research.outline", "research-content", "Content Researcher", "Researcher",
        parent_span_id=crew_lead["span_id"],
        model="gemini-1.5-pro", provider="Gemini",
        prompt_tokens=1200, completion_tokens=1500, latency_ms=2800,
        input_text="Research and outline a technical blog post on AI agent observability. Include statistics, real-world examples, and pain points.",
        output_text="Outline: 1) The multi-agent explosion (stats: 40% enterprise adoption by 2026) 2) The observability gap (3 pain points: debugging, cost, compliance) 3) Why traditional monitoring fails (APM designed for microservices, not agents) 4) What agent-native observability looks like (causal graphs, cost attribution, compliance) 5) Getting started (2 lines of code example)",
        decision_reasoning="Used Gemini for research — strong at synthesizing multiple sources. Structured outline around pain points for maximum engagement.",
        task_id=task, cost_usd=0.022,
    )

    writer = make_span(
        trace_id, "writer.draft", "writer-content", "Technical Writer", "Writer",
        parent_span_id=crew_lead["span_id"],
        model="claude-sonnet-4-6", provider="Anthropic",
        prompt_tokens=3000, completion_tokens=4000, latency_ms=6200,
        input_text="Write a 2000-word technical blog post based on the outline. Include Python code examples showing agent tracing. Target audience: senior engineers and CTOs.",
        output_text="# Why Every Multi-Agent System Needs Observability\n\nThe rise of multi-agent AI systems is creating a new class of debugging nightmares. When Agent A asks Agent B to research a topic, and Agent B delegates to Agent C for data analysis, understanding what went wrong — and why — becomes exponentially harder...\n\n```python\nimport agentwatch\nagentwatch.init()\n# Every LLM call is now traced automatically\n```\n\n... [2000 words covering all 5 outline sections with code examples, statistics, and a clear CTA]",
        decision_reasoning="Used Claude for long-form writing — consistently produces well-structured technical content. Maintained developer-friendly tone throughout.",
        task_id=task, cost_usd=0.048,
    )

    editor = make_span(
        trace_id, "editor.polish", "editor-content", "Technical Editor", "Editor",
        parent_span_id=crew_lead["span_id"],
        model="gpt-4o", provider="OpenAI",
        prompt_tokens=4500, completion_tokens=4200, latency_ms=5800,
        input_text="Edit the blog post for clarity, technical accuracy, and engagement. Ensure all code examples are correct and all statistics are sourced.",
        output_text="Edited version: 47 changes made. Key improvements: (1) Tightened intro — removed 3 redundant sentences, (2) Fixed code example — added missing import, (3) Added source citation for 40% statistic, (4) Strengthened CTA with specific next steps. Readability score improved from 62 to 78 (Flesch-Kincaid).",
        task_id=task, cost_usd=0.088,
    )

    seo = make_span(
        trace_id, "seo.optimize", "seo-content", "SEO Optimizer", "Optimizer",
        parent_span_id=crew_lead["span_id"],
        model="gpt-4o-mini", provider="OpenAI",
        prompt_tokens=1800, completion_tokens=600, latency_ms=900,
        input_text="Optimize blog post for SEO. Target keywords: AI observability, agent monitoring, LLM tracing, multi-agent debugging.",
        output_text='{"title": "Why Every Multi-Agent System Needs Observability in 2026", "meta_description": "Learn how to debug, monitor, and optimize multi-agent AI systems with 2 lines of code. Includes cost attribution, causal graphs, and EU AI Act compliance.", "keywords_density": {"ai observability": 1.2, "agent monitoring": 0.8, "llm tracing": 0.6}, "estimated_ranking_potential": "top 10 for \'ai agent observability\'"}',
        task_id=task, cost_usd=0.004,
    )

    for s in [crew_lead, researcher, writer, editor, seo]:
        ok = send_span(s)
        print(f"  {'OK' if ok else 'FAIL'} {s['agent_name']}: {s['name']}")
        time.sleep(0.1)

    return trace_id


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN — Run all 5 pipelines
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    if not API_KEY:
        print("ERROR: Set API_KEY or AGENTWATCH_API_KEY environment variable")
        print("  export AGENTWATCH_API_KEY=your-key")
        exit(1)

    print(f"Sending traces to {API_URL}")
    print(f"API Key: {API_KEY[:8]}...{API_KEY[-4:]}")
    print("=" * 60)

    trace_ids = []
    trace_ids.append(pipeline_eu_compliance())
    trace_ids.append(pipeline_customer_support())
    trace_ids.append(pipeline_market_research())
    trace_ids.append(pipeline_code_review())
    trace_ids.append(pipeline_content_crew())

    print("\n" + "=" * 60)
    print("DONE — 5 pipelines, 23 spans sent")
    print(f"\nTrace IDs:")
    for i, tid in enumerate(trace_ids):
        print(f"  [{i+1}] {tid}")
    print(f"\nVerify:")
    print(f"  curl -H 'X-API-Key: {API_KEY[:8]}...' {API_URL}/api/traces")
    print(f"\nPlayground:")
    print(f"  https://aeneassoft.com/playground (switch to Live mode)")
