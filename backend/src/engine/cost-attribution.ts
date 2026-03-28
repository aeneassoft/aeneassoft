// [PRODUCTNAME] Cost Attribution Engine
// Calculates token costs per span and aggregates per task/agent
//
// Override / extend pricing via MODEL_PRICING env var (JSON):
//   MODEL_PRICING='{"mistral-large":{"prompt":4,"completion":12}}'
// Values are USD per 1M tokens.

const DEFAULT_PRICING: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o':            { prompt: 5.00 / 1_000_000, completion: 15.00 / 1_000_000 },
  'gpt-4o-mini':       { prompt: 0.15 / 1_000_000, completion: 0.60 / 1_000_000 },
  'gpt-4-turbo':       { prompt: 10.00 / 1_000_000, completion: 30.00 / 1_000_000 },
  'gpt-3.5-turbo':     { prompt: 0.50 / 1_000_000, completion: 1.50 / 1_000_000 },
  'claude-opus-4-6':   { prompt: 15.00 / 1_000_000, completion: 75.00 / 1_000_000 },
  'claude-sonnet-4-6': { prompt: 3.00 / 1_000_000, completion: 15.00 / 1_000_000 },
  'claude-haiku-4-5':  { prompt: 0.80 / 1_000_000, completion: 4.00 / 1_000_000 },
  // Mistral
  'mistral-large':          { prompt: 4.00 / 1_000_000, completion: 12.00 / 1_000_000 },
  'mistral-large-latest':   { prompt: 4.00 / 1_000_000, completion: 12.00 / 1_000_000 },
  'mistral-small':          { prompt: 1.00 / 1_000_000, completion:  3.00 / 1_000_000 },
  'mistral-small-latest':   { prompt: 1.00 / 1_000_000, completion:  3.00 / 1_000_000 },
  // Groq (hosted models — Groq pricing, not model-native pricing)
  'llama3-70b-8192':        { prompt: 0.59 / 1_000_000, completion: 0.79 / 1_000_000 },
  'llama3-8b-8192':         { prompt: 0.05 / 1_000_000, completion: 0.08 / 1_000_000 },
  'llama3.1:8b':            { prompt: 0.00 / 1_000_000, completion: 0.00 / 1_000_000 }, // Ollama local
  'mixtral-8x7b-32768':     { prompt: 0.24 / 1_000_000, completion: 0.24 / 1_000_000 },
  'gemma2-9b-it':           { prompt: 0.20 / 1_000_000, completion: 0.20 / 1_000_000 },
  // Cohere
  'command-r-plus':         { prompt: 3.00 / 1_000_000, completion: 15.00 / 1_000_000 },
  'command-r':              { prompt: 0.50 / 1_000_000, completion:  1.50 / 1_000_000 },
  // Google
  'gemini-1.5-pro':         { prompt: 3.50 / 1_000_000, completion: 10.50 / 1_000_000 },
  'gemini-1.5-flash':       { prompt: 0.075 / 1_000_000, completion: 0.30 / 1_000_000 },
};

// Merge with env-supplied overrides (no recompile needed for new models)
function loadPricing(): Record<string, { prompt: number; completion: number }> {
  const base = { ...DEFAULT_PRICING };
  const env = process.env.MODEL_PRICING;
  if (!env) return base;
  try {
    const overrides = JSON.parse(env) as Record<string, { prompt: number; completion: number }>;
    for (const [model, prices] of Object.entries(overrides)) {
      base[model] = {
        prompt: prices.prompt / 1_000_000,
        completion: prices.completion / 1_000_000,
      };
    }
  } catch {
    console.warn('[PRODUCTNAME] Invalid MODEL_PRICING env var — using defaults');
  }
  return base;
}

const PRICING = loadPricing();

export function calculateSpanCost(span: any): number {
  const modelName = span.model_inference?.model_name || span.model_name;
  if (!modelName) return 0;

  const pricing = PRICING[modelName];
  if (!pricing) return span.cost_attribution?.accumulated_cost_usd || 0;

  const promptTokens = span.model_inference?.prompt_tokens || span.prompt_tokens || 0;
  const completionTokens = span.model_inference?.completion_tokens || span.completion_tokens || 0;

  return promptTokens * pricing.prompt + completionTokens * pricing.completion;
}

export function calculateGraphCost(spans: any[]): number {
  let totalCost = 0;
  for (const span of spans) {
    totalCost += calculateSpanCost(span);
  }
  return totalCost;
}

export function costBreakdownByAgent(spans: any[]): Record<string, { cost: number; tokens: number }> {
  const breakdown: Record<string, { cost: number; tokens: number }> = {};

  for (const span of spans) {
    const agentId = span.agent_id || 'unknown';
    if (!breakdown[agentId]) {
      breakdown[agentId] = { cost: 0, tokens: 0 };
    }
    breakdown[agentId].cost += calculateSpanCost(span);
    breakdown[agentId].tokens +=
      (span.model_inference?.prompt_tokens || span.prompt_tokens || 0) +
      (span.model_inference?.completion_tokens || span.completion_tokens || 0);
  }

  return breakdown;
}

export function costBreakdownByModel(spans: any[]): Record<string, { cost: number; calls: number }> {
  const breakdown: Record<string, { cost: number; calls: number }> = {};

  for (const span of spans) {
    const modelName = span.model_inference?.model_name || span.model_name || 'unknown';
    if (!breakdown[modelName]) {
      breakdown[modelName] = { cost: 0, calls: 0 };
    }
    breakdown[modelName].cost += calculateSpanCost(span);
    breakdown[modelName].calls += 1;
  }

  return breakdown;
}
