import { Kafka, Producer } from 'kafkajs';

let producer: Producer | null = null;

const BATCH_SIZE = parseInt(process.env.KAFKA_BATCH_SIZE || '50', 10);
const FLUSH_INTERVAL_MS = parseInt(process.env.KAFKA_FLUSH_MS || '500', 10);
const TOPIC = 'agent-traces';

let buffer: Array<{ value: string; key?: string }> = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    const kafka = new Kafka({
      clientId: 'aeneassoft-proxy',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    });
    producer = kafka.producer();
    await producer.connect();

    // Periodic flush
    flushTimer = setInterval(() => { flush().catch(() => {}); }, FLUSH_INTERVAL_MS);
  }
  return producer;
}

async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  try {
    const p = await getProducer();
    await p.send({ topic: TOPIC, messages: batch });
  } catch (err) {
    console.error(`AeneasSoft Failed to flush ${batch.length} spans to Kafka:`, err);
  }
}

export async function sendSpanToKafka(span: object): Promise<void> {
  try {
    const traceId = (span as Record<string, unknown>).trace_id as string | undefined;
    buffer.push({
      value: JSON.stringify(span),
      ...(traceId ? { key: traceId } : {}), // partition by trace_id for ordering
    });

    if (buffer.length >= BATCH_SIZE) {
      await flush();
    }
  } catch (err) {
    console.error('AeneasSoft Failed to buffer span:', err);
  }
}

export async function disconnectProducer(): Promise<void> {
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  await flush();
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
