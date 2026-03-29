// [PRODUCTNAME] Backend API Server
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { registerRoutes } from './api/routes';
import { registerAuthRoutes } from './api/auth-routes';
import { registerStripeRoutes } from './api/stripe-routes';
import { registerAlertRoutes } from './api/alert-routes';
import { registerBillingRoutes } from './api/billing-routes';
import { registerAuthMiddleware } from './middleware/auth';
import { startAlertWorker, stopAlertWorker } from './alert-worker';
import { initClickHouse } from './db/clickhouse';
import { startKafkaConsumer, stopKafkaConsumer } from './kafka-consumer';

async function main() {
  const fastify = Fastify({
    logger: true,
    bodyLimit: 1_048_576, // 1 MB max request body — prevents memory exhaustion
  });

  // Rate limiting: 1000 req/min per IP globally, stricter on ingest
  await fastify.register(rateLimit, {
    global: true,
    max: 1000,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded — max 1000 requests/minute per IP',
    }),
  });

  // CORS: restrict to configured origins only
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',').map(o => o.trim());
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  // Initialize ClickHouse tables
  const clickhouseUrl = process.env.CLICKHOUSE_URL || 'http://localhost:8123';
  try {
    await initClickHouse(clickhouseUrl);
    fastify.log.info('[PRODUCTNAME] ClickHouse initialized');
  } catch (err) {
    fastify.log.warn({ err }, '[PRODUCTNAME] ClickHouse not available, will retry on requests');
  }

  // Start Kafka consumer (proxy → Kafka → ClickHouse pipeline)
  try {
    await startKafkaConsumer();
    fastify.log.info('[PRODUCTNAME] Kafka consumer started');
  } catch (err) {
    fastify.log.warn({ err }, '[PRODUCTNAME] Kafka consumer failed to start, proxy ingestion unavailable');
  }

  // Auth middleware — protects all /api/* and /auth/me routes
  await registerAuthMiddleware(fastify);

  // Register auth routes (register, login, password reset, me)
  await registerAuthRoutes(fastify);

  // Register Stripe routes (checkout, webhook, portal)
  await registerStripeRoutes(fastify);

  // Register alert routes (CRUD + history)
  await registerAlertRoutes(fastify);

  // Register billing route (plan, usage, period)
  await registerBillingRoutes(fastify);

  // Register API routes (traces, metrics, cost, compliance, keys, contact)
  await registerRoutes(fastify);

  // Start alert worker (checks conditions every 60s)
  startAlertWorker();

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info('[PRODUCTNAME] Shutting down...');
    stopAlertWorker();
    await stopKafkaConsumer();
    await fastify.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start server
  const port = parseInt(process.env.PORT || '3001', 10);
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`[PRODUCTNAME] Backend API running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
