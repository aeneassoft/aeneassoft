import { describe, it, expect } from 'vitest';
import { ATPSpanSchema } from './schema';

describe('ATPSpanSchema', () => {
  it('should validate a valid span', () => {
    const validSpan = {
      trace_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      span_id: 'a1b2c3d4e5f6a1b2',
      name: 'openai.chat.completion',
      kind: 'CLIENT' as const,
      start_time_unix_nano: 1700000000000000000,
      end_time_unix_nano: 1700000001000000000,
      status: { code: 'OK' as const },
      agent_id: 'agent-01',
      agent_name: 'TestAgent',
      agent_role: 'Orchestrator',
      decision_reasoning: 'Delegating task to sub-agent',
      input: 'Hello world',
      output: 'Response text',
      model_inference: {
        model_name: 'gpt-4o',
        provider: 'OpenAI',
        prompt_tokens: 100,
        completion_tokens: 50,
        latency_ms: 1500,
      },
      cost_attribution: {
        task_id: 'task-001',
        accumulated_cost_usd: 0.0045,
      },
      compliance_flags: ['eu_ai_act_art12_relevant'],
      links: [
        {
          trace_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
          span_id: 'b1b2c3d4e5f6a1b2',
          link_type: 'REQUIRES' as const,
        },
      ],
      events: [
        {
          time_unix_nano: 1700000000500000000,
          name: 'agent.tool.start' as const,
          attributes: { tool: 'web_search' },
        },
      ],
      attributes: { custom_key: 'custom_value' },
    };

    const result = ATPSpanSchema.safeParse(validSpan);
    expect(result.success).toBe(true);
  });

  it('should reject a span with invalid trace_id', () => {
    const invalidSpan = {
      trace_id: 'not-a-valid-hex',
      span_id: 'a1b2c3d4e5f6a1b2',
      name: 'test',
      kind: 'CLIENT',
      start_time_unix_nano: 1700000000000000000,
      end_time_unix_nano: 1700000001000000000,
      status: { code: 'OK' },
      agent_id: 'agent-01',
      agent_name: 'TestAgent',
      agent_role: 'Orchestrator',
    };

    const result = ATPSpanSchema.safeParse(invalidSpan);
    expect(result.success).toBe(false);
  });

  it('should reject a span with missing required fields', () => {
    const incompleteSpan = {
      trace_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      span_id: 'a1b2c3d4e5f6a1b2',
      // missing name, kind, etc.
    };

    const result = ATPSpanSchema.safeParse(incompleteSpan);
    expect(result.success).toBe(false);
  });

  it('should reject a span with invalid status code', () => {
    const invalidStatus = {
      trace_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      span_id: 'a1b2c3d4e5f6a1b2',
      name: 'test',
      kind: 'CLIENT',
      start_time_unix_nano: 1700000000000000000,
      end_time_unix_nano: 1700000001000000000,
      status: { code: 'INVALID' },
      agent_id: 'agent-01',
      agent_name: 'TestAgent',
      agent_role: 'Orchestrator',
    };

    const result = ATPSpanSchema.safeParse(invalidStatus);
    expect(result.success).toBe(false);
  });

  it('should accept a minimal valid span (no optional fields)', () => {
    const minimalSpan = {
      trace_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      span_id: 'a1b2c3d4e5f6a1b2',
      name: 'minimal.span',
      kind: 'INTERNAL' as const,
      start_time_unix_nano: 0,
      end_time_unix_nano: 1000000,
      status: { code: 'UNSET' as const },
      agent_id: 'a',
      agent_name: 'A',
      agent_role: 'R',
    };

    const result = ATPSpanSchema.safeParse(minimalSpan);
    expect(result.success).toBe(true);
  });
});
