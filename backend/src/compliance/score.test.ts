import { describe, it, expect } from 'vitest';
import { calculateComplianceScore } from './score';

function makeSpan(overrides: Record<string, any> = {}) {
  return {
    trace_id: 'a'.repeat(32),
    span_id: 'b'.repeat(16),
    name: 'test.span',
    kind: 'INTERNAL',
    start_time_unix_nano: 1000000000,
    end_time_unix_nano: 2000000000,
    status_code: 'OK',
    agent_id: 'agent-01',
    agent_name: 'TestAgent',
    agent_role: 'Orchestrator',
    ...overrides,
  };
}

describe('calculateComplianceScore', () => {
  it('returns score 0 and LOW level for empty spans', () => {
    const result = calculateComplianceScore('a'.repeat(32), []);
    expect(result.score).toBe(0);
    expect(result.level).toBe('LOW');
    expect(result.missing).toContain('No spans found for this trace');
  });

  it('returns HIGH score for a fully compliant trace', () => {
    const spans = [
      makeSpan({
        compliance_flags: ['eu_ai_act_art12_relevant'],
        decision_reasoning: 'Orchestrating tasks based on user request analysis',
        input: 'User asked for a summary',
        output: 'Summary generated successfully',
        task_id: 'task-001',
        cost_attribution: { task_id: 'task-001', accumulated_cost_usd: 0.002 },
      }),
      makeSpan({
        span_id: 'c'.repeat(16),
        agent_id: 'agent-02',
        agent_name: 'ResearchAgent',
        agent_role: 'Researcher',
        compliance_flags: ['eu_ai_act_art12_relevant'],
        decision_reasoning: 'Searching web for relevant information based on query',
        input: 'query: AI regulation EU',
        output: 'Found 10 relevant documents',
        task_id: 'task-001',
        cost_attribution: { task_id: 'task-001', accumulated_cost_usd: 0.001 },
      }),
    ];
    const result = calculateComplianceScore('a'.repeat(32), spans);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.level).toBe('HIGH');
  });

  it('returns LOW score when no compliance flags set', () => {
    const spans = [makeSpan()];
    const result = calculateComplianceScore('a'.repeat(32), spans);
    expect(result.score).toBeLessThan(50);
    const failedCheck = result.checks.find(c => c.id === 'art12_flags');
    expect(failedCheck?.status).toBe('fail');
  });

  it('penalizes error spans without status messages', () => {
    const spans = [
      makeSpan({ compliance_flags: ['eu_ai_act_art12_relevant'] }),
      makeSpan({ span_id: 'c'.repeat(16), status_code: 'ERROR' }), // no message
    ];
    const result = calculateComplianceScore('a'.repeat(32), spans);
    const errorCheck = result.checks.find(c => c.id === 'error_documentation');
    expect(errorCheck?.status).not.toBe('pass');
  });

  it('passes error check when error spans have messages', () => {
    const spans = [
      makeSpan({
        span_id: 'c'.repeat(16),
        status_code: 'ERROR',
        status_message: 'Timeout after 30s',
        compliance_flags: ['eu_ai_act_art12_relevant'],
      }),
    ];
    const result = calculateComplianceScore('a'.repeat(32), spans);
    const errorCheck = result.checks.find(c => c.id === 'error_documentation');
    expect(errorCheck?.status).toBe('pass');
  });

  it('result has all required fields', () => {
    const result = calculateComplianceScore('a'.repeat(32), [makeSpan()]);
    expect(result).toHaveProperty('trace_id');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('level');
    expect(result).toHaveProperty('checks');
    expect(result).toHaveProperty('missing');
    expect(result).toHaveProperty('generated_at');
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('score is always between 0 and 100', () => {
    const result = calculateComplianceScore('a'.repeat(32), [makeSpan()]);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
