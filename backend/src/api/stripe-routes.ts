// [PRODUCTNAME] Stripe Routes — Checkout, Webhooks, Billing Portal
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { findUserById, updateUser, findUserByEmail, findUserByStripeCustomerId } from '../db/clickhouse';
import { sendPaymentFailedEmail, sendSubscriptionCancelledEmail } from '../emails';

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key);
}

export async function registerStripeRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /stripe/checkout — create checkout session
  fastify.post('/stripe/checkout', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const { plan } = request.body as { plan?: string };
    if (!plan || !['pro', 'enterprise'].includes(plan)) {
      return reply.status(400).send({ error: 'Plan must be "pro" or "enterprise"' });
    }

    const user = await findUserById(CLICKHOUSE_URL, request.userId);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const stripe = getStripe();
    const priceId = plan === 'pro'
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_ENTERPRISE_PRICE_ID;

    if (!priceId) {
      return reply.status(500).send({ error: `Price ID not configured for plan: ${plan}` });
    }

    // Create or reuse Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { org_id: user.org_id, user_id: user.id },
      });
      customerId = customer.id;
      await updateUser(CLICKHOUSE_URL, user.email, { stripe_customer_id: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://aeneassoft.com/dashboard?success=true',
      cancel_url: 'https://aeneassoft.com/pricing?canceled=true',
      metadata: { user_id: user.id, org_id: user.org_id, plan },
    });

    return reply.send({ url: session.url });
  });

  // POST /stripe/webhook — handle Stripe events
  fastify.post('/stripe/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const stripe = getStripe();
    const sig = request.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      fastify.log.error('[PRODUCTNAME] STRIPE_WEBHOOK_SECRET not configured');
      return reply.status(500).send({ error: 'Webhook secret not configured' });
    }

    let event: Stripe.Event;
    try {
      // Use raw body for signature verification
      const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      fastify.log.error({ err }, '[PRODUCTNAME] Stripe webhook signature verification failed');
      return reply.status(400).send({ error: 'Webhook signature verification failed' });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const plan = session.metadata?.plan || 'pro';
        const email = session.customer_email || session.customer_details?.email;
        if (email) {
          await updateUser(CLICKHOUSE_URL, email, {
            plan,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          });
          fastify.log.info(`[PRODUCTNAME] User ${email} upgraded to ${plan}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const user = await findUserByStripeCustomerId(CLICKHOUSE_URL, customerId);
        if (user) {
          await updateUser(CLICKHOUSE_URL, user.email, { plan: 'free', stripe_subscription_id: null });
          sendSubscriptionCancelledEmail(user.email).catch(err =>
            fastify.log.error({ err }, '[PRODUCTNAME] Failed to send subscription cancelled email'));
          fastify.log.info(`[PRODUCTNAME] Subscription deleted for ${user.email} — downgraded to free`);
        } else {
          fastify.log.warn(`[PRODUCTNAME] Subscription deleted for unknown customer ${customerId}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        fastify.log.warn(`[PRODUCTNAME] Payment failed for customer ${invoice.customer}`);
        const customerEmail = invoice.customer_email;
        if (customerEmail) {
          sendPaymentFailedEmail(customerEmail).catch(err =>
            fastify.log.error({ err }, '[PRODUCTNAME] Failed to send payment-failed email'));
        }
        break;
      }

      default:
        fastify.log.info(`[PRODUCTNAME] Unhandled Stripe event: ${event.type}`);
    }

    return reply.send({ received: true });
  });

  // GET /stripe/portal — redirect to Stripe billing portal
  fastify.get('/stripe/portal', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const user = await findUserById(CLICKHOUSE_URL, request.userId);
    if (!user?.stripe_customer_id) {
      return reply.status(400).send({ error: 'No active subscription. Subscribe first at /pricing.' });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: 'https://aeneassoft.com/dashboard/billing',
    });

    return reply.send({ url: session.url });
  });
}
