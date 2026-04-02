// AeneasSoft Kafka Consumer — reads ATP spans from agent-traces topic
// Uses batch processing for high-throughput multi-agent scenarios.
// Throughput: ~1000+ spans/sec with batch size 100, flush interval 500ms.
//
// Reliability: retry with exponential backoff → DLQ on permanent failure.
// Circuit breaker: pauses consumption when ClickHouse is unreachable.
import { Kafka, Consumer, Producer, EachBatchPayload } from 'kafkajs';
import { insertSpanBatch } from './db/clickhouse';

let consumer: Consumer | null = null;
let producer: Producer | null = null;
let running = false;

const TOPIC = 'agent-traces';
const DLQ_TOPIC = 'agent-traces-dlq';
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';
const BATCH_SIZE = parseInt(process.env.KAFKA_BATCH_SIZE || '100', 10);
const MAX_RETRIES = parseInt(process.env.KAFKA_MAX_RETRIES || '5', 10);
const INITIAL_BACKOFF_MS = 1000;

// ── Circuit Breaker ─────────────────────────────────────────────────────────
// Trips after consecutive failures, pauses consumption to let ClickHouse recover.
let consecutiveFailures = 0;
const CB_THRESHOLD = 3;       // Trip after 3 consecutive failures
const CB_COOLDOWN_MS = 30_000; // Wait 30s before retrying after trip
let circuitOpen = false;
let circuitOpenSince = 0;

function checkCircuitBreaker(): boolean {
  if (!circuitOpen) return false;
  const elapsed = Date.now() - circuitOpenSince;
  if (elapsed >= CB_COOLDOWN_MS) {
    console.log(`AeneasSoft Kafka CB: half-open after ${(elapsed / 1000).toFixed(0)}s cooldown, retrying...`);
    circuitOpen = false;
    return false;
  }
  return true; // still open
}

function recordSuccess(): void {
  if (consecutiveFailures > 0) {
    console.log(`AeneasSoft Kafka CB: recovered after ${consecutiveFailures} failures`);
  }
  consecutiveFailures = 0;
  circuitOpen = false;
}

function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= CB_THRESHOLD && !circuitOpen) {
    circuitOpen = true;
    circuitOpenSince = Date.now();
    console.error(`AeneasSoft Kafka CB: OPEN after ${consecutiveFailures} consecutive failures. Pausing for ${CB_COOLDOWN_MS / 1000}s.`);
  }
}

// ── Retry with exponential backoff ──────────────────────────────────────────
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function insertWithRetry(spans: any[]): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await insertSpanBatch(CLICKHOUSE_URL, spans);
      recordSuccess();
      return;
    } catch (err: any) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s, 16s
      const isLastAttempt = attempt === MAX_RETRIES;

      if (isLastAttempt) {
        recordFailure();
        throw err; // Exhausted retries → caller sends to DLQ
      }

      console.warn(
        `AeneasSoft ClickHouse insert failed (attempt ${attempt}/${MAX_RETRIES}, ` +
        `${spans.length} spans). Retrying in ${backoff}ms...`,
        err.message || err
      );
      await sleep(backoff);
    }
  }
}

// ── DLQ Producer ────────────────────────────────────────────────────────────
async function getProducer(brokers: string[]): Promise<Producer> {
  if (!producer) {
    const kafka = new Kafka({ clientId: 'aeneassoft-backend-dlq', brokers });
    producer = kafka.producer();
    await producer.connect();
  }
  return producer;
}

async function sendToDLQ(spans: any[], error: string, brokers: string[]): Promise<void> {
  try {
    const p = await getProducer(brokers);
    await p.send({
      topic: DLQ_TOPIC,
      messages: spans.map(span => ({
        value: JSON.stringify({
          original_span: span,
          error,
          failed_at: new Date().toISOString(),
          retries_exhausted: MAX_RETRIES,
        }),
      })),
    });
    console.error(
      `AeneasSoft ${spans.length} spans sent to DLQ (${DLQ_TOPIC}) after ${MAX_RETRIES} failed retries: ${error}`
    );
  } catch (dlqErr) {
    // DLQ itself failed — log loudly, this is critical data loss
    console.error(
      `AeneasSoft CRITICAL: Failed to send ${spans.length} spans to DLQ. DATA LOSS.`,
      dlqErr
    );
  }
}

// ── Main Consumer ───────────────────────────────────────────────────────────
export async function startKafkaConsumer(): Promise<void> {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

  const kafka = new Kafka({
    clientId: 'aeneassoft-backend',
    brokers,
    retry: { initialRetryTime: 1000, retries: 10 },
  });

  consumer = kafka.consumer({
    groupId: 'aeneassoft-backend-group',
    // Allow up to BATCH_SIZE messages to be fetched per partition per request
    maxInFlightRequests: 1,
  });

  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  running = true;
  console.log(
    `AeneasSoft Kafka consumer connected (batch_size=${BATCH_SIZE}, max_retries=${MAX_RETRIES}), topic="${TOPIC}"`
  );

  await consumer.run({
    // Process in batches for high throughput
    eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning }: EachBatchPayload) => {
      const spans: any[] = [];
      const offsets: string[] = [];

      for (const message of batch.messages) {
        if (!isRunning()) break;
        if (!message.value) continue;

        try {
          const span = JSON.parse(message.value.toString());
          spans.push(span);
          offsets.push(message.offset);
        } catch {
          // Unparseable JSON is permanent — skip and commit offset
          console.error('AeneasSoft Unparseable Kafka message, skipping');
          resolveOffset(message.offset);
        }

        // Flush when batch size reached
        if (spans.length >= BATCH_SIZE) {
          await flushBatch(spans, offsets, resolveOffset, brokers);
          await heartbeat();
          spans.length = 0;
          offsets.length = 0;
        }
      }

      // Flush remainder
      if (spans.length > 0) {
        await flushBatch(spans, offsets, resolveOffset, brokers);
        await heartbeat();
      }
    },
  });
}

async function flushBatch(
  spans: any[],
  offsets: string[],
  resolveOffset: (offset: string) => void,
  brokers: string[]
): Promise<void> {
  // Circuit breaker: if ClickHouse is down, wait before retrying
  if (checkCircuitBreaker()) {
    console.warn(`AeneasSoft Kafka CB: circuit open, waiting ${CB_COOLDOWN_MS / 1000}s before flush...`);
    await sleep(CB_COOLDOWN_MS);
  }

  try {
    await insertWithRetry(spans);
    // Only commit offsets after successful write to ClickHouse
    for (const offset of offsets) {
      resolveOffset(offset);
    }
    console.log(`AeneasSoft Flushed ${spans.length} spans to ClickHouse`);
  } catch (err: any) {
    // All retries exhausted — send to Dead Letter Queue, then commit offsets
    await sendToDLQ(spans, err.message || String(err), brokers);
    for (const offset of offsets) {
      resolveOffset(offset);
    }
  }
}

export async function stopKafkaConsumer(): Promise<void> {
  if (consumer && running) {
    running = false;
    await consumer.disconnect();
    consumer = null;
    console.log('AeneasSoft Kafka consumer disconnected');
  }
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
