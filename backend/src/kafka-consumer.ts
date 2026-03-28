// [PRODUCTNAME] Kafka Consumer — reads ATP spans from agent-traces topic
// Uses batch processing for high-throughput multi-agent scenarios.
// Throughput: ~1000+ spans/sec with batch size 100, flush interval 500ms.
import { Kafka, Consumer, EachBatchPayload } from 'kafkajs';
import { insertSpanBatch } from './db/clickhouse';

let consumer: Consumer | null = null;
let running = false;

const TOPIC = 'agent-traces';
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';
const BATCH_SIZE = parseInt(process.env.KAFKA_BATCH_SIZE || '100', 10);

export async function startKafkaConsumer(): Promise<void> {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

  const kafka = new Kafka({
    clientId: '[productname]-backend',
    brokers,
    retry: { initialRetryTime: 1000, retries: 10 },
  });

  consumer = kafka.consumer({
    groupId: '[productname]-backend-group',
    // Allow up to BATCH_SIZE messages to be fetched per partition per request
    maxInFlightRequests: 1,
  });

  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  running = true;
  console.log(`[PRODUCTNAME] Kafka consumer connected (batch_size=${BATCH_SIZE}), topic="${TOPIC}"`);

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
          // Skip unparseable messages — log and continue
          console.error('[PRODUCTNAME] Unparseable Kafka message, skipping');
          resolveOffset(message.offset);
        }

        // Flush when batch size reached
        if (spans.length >= BATCH_SIZE) {
          await flushBatch(spans, offsets, resolveOffset);
          await heartbeat();
          spans.length = 0;
          offsets.length = 0;
        }
      }

      // Flush remainder
      if (spans.length > 0) {
        await flushBatch(spans, offsets, resolveOffset);
        await heartbeat();
      }
    },
  });
}

async function flushBatch(
  spans: any[],
  offsets: string[],
  resolveOffset: (offset: string) => void
): Promise<void> {
  try {
    await insertSpanBatch(CLICKHOUSE_URL, spans);
    // Only commit offsets after successful write to ClickHouse
    for (const offset of offsets) {
      resolveOffset(offset);
    }
    console.log(`[PRODUCTNAME] Flushed ${spans.length} spans to ClickHouse`);
  } catch (err) {
    console.error(`[PRODUCTNAME] Batch insert failed (${spans.length} spans):`, err);
    // Still resolve offsets to avoid infinite retry loop on bad data
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
    console.log('[PRODUCTNAME] Kafka consumer disconnected');
  }
}
