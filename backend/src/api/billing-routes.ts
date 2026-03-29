// [PRODUCTNAME] Billing Route — GET /api/billing
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { findUserById, queryBillingUsage } from '../db/clickhouse';

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

const PLAN_LIMITS: Record<string, number | null> = {
  free: 10_000,
  pro: 100_000,
  enterprise: null,
};

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function registerBillingRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/billing — current plan, usage, period
  fastify.get('/api/billing', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const user = await findUserById(CLICKHOUSE_URL, request.userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Fetch Stripe subscription period if available
    let current_period_end: string | null = null;
    if (user.stripe_subscription_id) {
      const stripe = getStripe();
      if (stripe) {
        try {
          const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id) as any;
          current_period_end = new Date(sub.current_period_end * 1000).toISOString();
        } catch (err) {
          fastify.log.warn({ err }, '[PRODUCTNAME] Failed to fetch Stripe subscription');
        }
      }
    }

    // Fetch usage from ClickHouse
    const usage = await queryBillingUsage(CLICKHOUSE_URL, user.org_id);

    return reply.send({
      plan: user.plan,
      renewsAt: current_period_end,
      usage: {
        traces: usage.traces_this_month,
        limit: PLAN_LIMITS[user.plan] ?? PLAN_LIMITS.free,
        cost_this_month_usd: usage.cost_this_month_usd,
      },
      stripe_customer_id: user.stripe_customer_id || null,
    });
  });
}
