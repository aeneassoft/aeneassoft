import { describe, it, expect } from 'vitest';
import { calculateSpanCost, calculateGraphCost, costBreakdownByAgent } from './cost-attribution';

describe('Cost Attribution', () => {
  it('should calculate cost for a known model', () => {
    const span = {
      model_inference: {
        model_name: 'gpt-4o',
        prompt_tokens: 1000,
        completion_tokens: 500,
      },
    };

    const cost = calculateSpanCost(span);
    // gpt-4o: 1000 * 5/1M + 500 * 15/1M = 0.005 + 0.0075 = 0.0125
    expect(cost).toBeCloseTo(0.0125, 4);
  });

  it('should return 0 for unknown model without fallback', () => {
    const span = {
      model_inference: {
        model_name: 'unknown-model',
        prompt_tokens: 1000,
        completion_tokens: 500,
      },
    };

    const cost = calculateSpanCost(span);
    expect(cost).toBe(0);
  });

  it('should calculate graph total cost', () => {
    const spans = [
      {
        model_inference: { model_name: 'gpt-4o-mini', prompt_tokens: 200, completion_tokens: 800 },
      },
      {
        model_inference: { model_name: 'claude-sonnet-4-6', prompt_tokens: 1200, completion_tokens: 400 },
      },
    ];

    const totalCost = calculateGraphCost(spans);
    // gpt-4o-mini: 200*0.15/1M + 800*0.60/1M = 0.00003 + 0.00048 = 0.00051
    // claude-sonnet-4-6: 1200*3/1M + 400*15/1M = 0.0036 + 0.006 = 0.0096
    expect(totalCost).toBeCloseTo(0.01011, 4);
  });

  it('should break down costs by agent', () => {
    const spans = [
      {
        agent_id: 'orch-01',
        model_inference: { model_name: 'gpt-4o', prompt_tokens: 500, completion_tokens: 150 },
      },
      {
        agent_id: 'res-01',
        model_inference: { model_name: 'gpt-4o-mini', prompt_tokens: 200, completion_tokens: 800 },
      },
    ];

    const breakdown = costBreakdownByAgent(spans);
    expect(Object.keys(breakdown)).toHaveLength(2);
    expect(breakdown['orch-01'].cost).toBeGreaterThan(0);
    expect(breakdown['res-01'].cost).toBeGreaterThan(0);
    expect(breakdown['orch-01'].tokens).toBe(650);
    expect(breakdown['res-01'].tokens).toBe(1000);
  });
});
