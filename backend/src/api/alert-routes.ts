// [PRODUCTNAME] Alert Routes — CRUD for alert rules + history
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import {
  getAlertRules,
  createAlertRule,
  deleteAlertRule,
  getAlertHistory,
} from '../db/clickhouse';

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

const VALID_TRIGGER_TYPES = ['cost_per_hour', 'cost_per_agent', 'error_rate'];
const VALID_ACTION_TYPES = ['email', 'webhook'];

export async function registerAlertRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/alerts — list alert rules
  fastify.get('/api/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    const rules = await getAlertRules(CLICKHOUSE_URL, orgId);
    return reply.send({ rules });
  });

  // POST /api/alerts — create alert rule
  fastify.post('/api/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    const body = request.body as {
      name?: string;
      trigger_type?: string;
      threshold?: number;
      time_window_minutes?: number;
      action_type?: string;
      action_target?: string;
    };

    if (!body.name || !body.trigger_type || body.threshold == null || !body.action_type || !body.action_target) {
      return reply.status(400).send({ error: 'Missing required fields: name, trigger_type, threshold, action_type, action_target' });
    }

    if (!VALID_TRIGGER_TYPES.includes(body.trigger_type)) {
      return reply.status(400).send({ error: `Invalid trigger_type. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}` });
    }

    if (!VALID_ACTION_TYPES.includes(body.action_type)) {
      return reply.status(400).send({ error: `Invalid action_type. Must be one of: ${VALID_ACTION_TYPES.join(', ')}` });
    }

    const rule = {
      id: randomUUID(),
      org_id: orgId,
      name: body.name,
      trigger_type: body.trigger_type,
      threshold: body.threshold,
      time_window_minutes: body.time_window_minutes || 60,
      action_type: body.action_type,
      action_target: body.action_target,
      is_active: 1,
    };

    await createAlertRule(CLICKHOUSE_URL, rule);
    return reply.status(201).send({ rule });
  });

  // DELETE /api/alerts/:id — delete alert rule
  fastify.delete<{ Params: { id: string } }>('/api/alerts/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    await deleteAlertRule(CLICKHOUSE_URL, request.params.id, orgId);
    return reply.send({ deleted: true });
  });

  // GET /api/alerts/history — alert history
  fastify.get('/api/alerts/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId || 'default';
    const history = await getAlertHistory(CLICKHOUSE_URL, orgId);
    return reply.send({ history });
  });
}
