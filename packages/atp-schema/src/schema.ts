import { z } from 'zod';

export const StatusSchema = z.object({
  code: z.enum(['UNSET', 'OK', 'ERROR']),
  message: z.string().optional(),
});

export const ToolCallSchema = z.object({
  tool_name: z.string(),
  tool_input: z.string(),
  tool_output: z.string().optional(),
  tool_status: z.enum(['SUCCESS', 'FAILURE', 'TIMEOUT']).optional(),
});

export const ModelInferenceSchema = z.object({
  model_name: z.string().optional(),
  provider: z.string().optional(),
  prompt_tokens: z.number().int().nonnegative().optional(),
  completion_tokens: z.number().int().nonnegative().optional(),
  latency_ms: z.number().int().nonnegative().optional(),
});

export const CostAttributionSchema = z.object({
  task_id: z.string(),
  accumulated_cost_usd: z.number().nonnegative().optional(),
});

export const LinkSchema = z.object({
  trace_id: z.string().regex(/^[0-9a-f]{32}$/),
  span_id: z.string().regex(/^[0-9a-f]{16}$/),
  link_type: z.enum([
    'FOLLOWS_FROM',
    'CAUSES',
    'RELATED_TO',
    'RETRY_OF',
    'RESPONSE_TO',
    'DELEGATES_TO',
    'REQUIRES',
    'CONSENSUS_FOR',
  ]),
});

export const EventSchema = z.object({
  time_unix_nano: z.number().int().nonnegative(),
  name: z.enum([
    'agent.communication.send',
    'agent.communication.receive',
    'agent.tool.start',
    'agent.tool.end',
    'agent.reasoning.step',
    'agent.error.recoverable',
    'agent.error.fatal',
  ]),
  attributes: z.record(z.any()).optional(),
});

export const ATPSpanSchema = z.object({
  trace_id: z.string().regex(/^[0-9a-f]{32}$/),
  span_id: z.string().regex(/^[0-9a-f]{16}$/),
  parent_span_id: z.string().regex(/^[0-9a-f]{16}$/).nullish(),
  name: z.string().min(1),
  kind: z.enum(['INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER']),
  start_time_unix_nano: z.number().int().nonnegative(),
  end_time_unix_nano: z.number().int().nonnegative(),
  status: StatusSchema,
  agent_id: z.string().min(1),
  agent_name: z.string().min(1),
  agent_role: z.string().min(1),
  decision_reasoning: z.string().optional(),
  input: z.string().optional(),
  output: z.string().optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
  model_inference: ModelInferenceSchema.optional(),
  cost_attribution: CostAttributionSchema.optional(),
  compliance_flags: z.array(z.string()).optional(),
  links: z.array(LinkSchema).optional(),
  events: z.array(EventSchema).optional(),
  attributes: z.record(z.any()).optional(),
});

export type ATPSpan = z.infer<typeof ATPSpanSchema>;
export type Status = z.infer<typeof StatusSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ModelInference = z.infer<typeof ModelInferenceSchema>;
export type CostAttribution = z.infer<typeof CostAttributionSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type Event = z.infer<typeof EventSchema>;
