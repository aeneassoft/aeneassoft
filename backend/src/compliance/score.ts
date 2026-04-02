// AeneasSoft EU AI Act Readiness Score Engine
// Calculates a 0-100 score based on how well a trace satisfies
// EU AI Act Article 12 (record-keeping) and Article 13 (transparency).

export interface ComplianceCheck {
  id: string;
  article: 'Art. 12' | 'Art. 13' | 'General';
  name: string;
  description: string;
  weight: number;   // max points this check contributes
  earned: number;   // points actually earned
  status: 'pass' | 'partial' | 'fail';
  detail: string;   // human-readable explanation
}

export interface ComplianceScoreResult {
  trace_id: string;
  score: number;            // 0–100
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  span_count: number;
  checks: ComplianceCheck[];
  missing: string[];        // top actionable items
  generated_at: string;
}

function hasFlag(span: any, flag: string): boolean {
  const flags = span.compliance_flags;
  if (!flags) return false;
  if (Array.isArray(flags)) return flags.includes(flag);
  if (typeof flags === 'string') return flags.includes(flag);
  return false;
}

function level(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 75) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

export function calculateComplianceScore(traceId: string, spans: any[]): ComplianceScoreResult {
  if (spans.length === 0) {
    return {
      trace_id: traceId,
      score: 0,
      level: 'LOW',
      span_count: 0,
      checks: [],
      missing: ['No spans found for this trace'],
      generated_at: new Date().toISOString(),
    };
  }

  const checks: ComplianceCheck[] = [];

  // ── CHECK 1: Art. 12 — Spans flagged as record-keeping relevant (20 pts)
  const art12Spans = spans.filter(s => hasFlag(s, 'eu_ai_act_art12_relevant'));
  const art12Ratio = art12Spans.length / spans.length;
  const check1Earned = art12Spans.length > 0 ? (art12Ratio >= 0.5 ? 20 : 10) : 0;
  checks.push({
    id: 'art12_flags',
    article: 'Art. 12',
    name: 'Record-Keeping Flags',
    description: 'Spans must be flagged with eu_ai_act_art12_relevant to establish an audit trail.',
    weight: 20,
    earned: check1Earned,
    status: check1Earned === 20 ? 'pass' : check1Earned > 0 ? 'partial' : 'fail',
    detail: art12Spans.length > 0
      ? `${art12Spans.length}/${spans.length} spans flagged (${Math.round(art12Ratio * 100)}%)`
      : 'No spans carry the eu_ai_act_art12_relevant flag',
  });

  // ── CHECK 2: Art. 12 — Decision reasoning on flagged spans (20 pts)
  const spansNeedingReasoning = art12Spans.length > 0 ? art12Spans : spans;
  const withReasoning = spansNeedingReasoning.filter(s => s.decision_reasoning && s.decision_reasoning.trim().length > 10);
  const reasoningRatio = withReasoning.length / spansNeedingReasoning.length;
  const check2Earned = reasoningRatio >= 0.8 ? 20 : reasoningRatio >= 0.4 ? 10 : reasoningRatio > 0 ? 5 : 0;
  checks.push({
    id: 'art12_reasoning',
    article: 'Art. 12',
    name: 'Decision Reasoning',
    description: 'Art. 12 requires logging the reasoning behind AI decisions.',
    weight: 20,
    earned: check2Earned,
    status: check2Earned === 20 ? 'pass' : check2Earned > 0 ? 'partial' : 'fail',
    detail: `${withReasoning.length}/${spansNeedingReasoning.length} relevant spans have decision_reasoning`,
  });

  // ── CHECK 3: Art. 13 — Agent identity complete on all spans (20 pts)
  const withFullIdentity = spans.filter(
    s => s.agent_id && s.agent_name && s.agent_role &&
         s.agent_id.length > 0 && s.agent_name.length > 0 && s.agent_role.length > 0
  );
  const identityRatio = withFullIdentity.length / spans.length;
  const check3Earned = identityRatio >= 0.95 ? 20 : identityRatio >= 0.7 ? 12 : identityRatio > 0 ? 5 : 0;
  checks.push({
    id: 'art13_identity',
    article: 'Art. 13',
    name: 'Agent Identity',
    description: 'Art. 13 requires transparency about agents: each span must identify the agent (id, name, role).',
    weight: 20,
    earned: check3Earned,
    status: check3Earned === 20 ? 'pass' : check3Earned > 0 ? 'partial' : 'fail',
    detail: `${withFullIdentity.length}/${spans.length} spans have complete agent identity`,
  });

  // ── CHECK 4: Art. 13 — Multiple distinct agents documented (10 pts)
  const uniqueAgents = new Set(spans.map(s => s.agent_id).filter(Boolean));
  const uniqueRoles = new Set(spans.map(s => s.agent_role).filter(r => r && r !== 'unknown'));
  const check4Earned = uniqueAgents.size >= 2 && uniqueRoles.size >= 2 ? 10 : uniqueAgents.size >= 1 ? 5 : 0;
  checks.push({
    id: 'art13_multi_agent',
    article: 'Art. 13',
    name: 'Agent Transparency',
    description: 'Distinct agents with documented roles demonstrate a transparent multi-agent system.',
    weight: 10,
    earned: check4Earned,
    status: check4Earned === 10 ? 'pass' : check4Earned > 0 ? 'partial' : 'fail',
    detail: `${uniqueAgents.size} unique agent(s), ${uniqueRoles.size} distinct role(s)`,
  });

  // ── CHECK 5: Audit Trail — input/output present (15 pts)
  const withIO = spans.filter(s => (s.input && s.input.length > 0) || (s.output && s.output.length > 0));
  const ioRatio = withIO.length / spans.length;
  const check5Earned = ioRatio >= 0.6 ? 15 : ioRatio >= 0.3 ? 8 : ioRatio > 0 ? 3 : 0;
  checks.push({
    id: 'audit_trail',
    article: 'Art. 12',
    name: 'Input/Output Logging',
    description: 'A complete audit trail requires logging inputs and outputs for traceability.',
    weight: 15,
    earned: check5Earned,
    status: check5Earned === 15 ? 'pass' : check5Earned > 0 ? 'partial' : 'fail',
    detail: `${withIO.length}/${spans.length} spans have input or output logged`,
  });

  // ── CHECK 6: Cost Attribution (5 pts)
  const withCost = spans.filter(s => s.task_id || s.cost_attribution?.task_id);
  const check6Earned = withCost.length > 0 ? 5 : 0;
  checks.push({
    id: 'cost_attribution',
    article: 'General',
    name: 'Cost Attribution',
    description: 'Task-level cost tracking enables accountability reporting.',
    weight: 5,
    earned: check6Earned,
    status: check6Earned > 0 ? 'pass' : 'fail',
    detail: `${withCost.length}/${spans.length} spans have cost attribution`,
  });

  // ── CHECK 7: Error Handling — ERROR spans have status message (10 pts)
  const errorSpans = spans.filter(s => (s.status_code || s.status?.code) === 'ERROR');
  const errorsWithMessage = errorSpans.filter(s => s.status_message || s.status?.message);
  const check7Earned = errorSpans.length === 0
    ? 10
    : errorsWithMessage.length === errorSpans.length
    ? 10
    : Math.round((errorsWithMessage.length / errorSpans.length) * 10);
  checks.push({
    id: 'error_documentation',
    article: 'Art. 12',
    name: 'Error Documentation',
    description: 'Errors must be documented with explanatory messages for Art. 12 compliance.',
    weight: 10,
    earned: check7Earned,
    status: check7Earned === 10 ? 'pass' : check7Earned > 0 ? 'partial' : 'fail',
    detail: errorSpans.length === 0
      ? 'No error spans in this trace'
      : `${errorsWithMessage.length}/${errorSpans.length} error spans have status messages`,
  });

  // ── Aggregate score
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const totalEarned = checks.reduce((sum, c) => sum + c.earned, 0);
  const score = Math.round((totalEarned / totalWeight) * 100);

  // ── Build missing list (only failed/partial checks, sorted by weight desc)
  const missing = checks
    .filter(c => c.status !== 'pass')
    .sort((a, b) => (b.weight - b.earned) - (a.weight - a.earned))
    .map(c => `[${c.article}] ${c.name}: ${c.detail}`);

  return {
    trace_id: traceId,
    score,
    level: level(score),
    span_count: spans.length,
    checks,
    missing,
    generated_at: new Date().toISOString(),
  };
}
