import { Kafka, Producer } from 'kafkajs';

let producer: Producer | null = null;

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    const kafka = new Kafka({
      clientId: '[productname]-proxy',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    });
    producer = kafka.producer();
    await producer.connect();
  }
  return producer;
}

export async function sendSpanToKafka(span: object): Promise<void> {
  try {
    const p = await getProducer();
    await p.send({
      topic: 'agent-traces',
      messages: [{ value: JSON.stringify(span) }],
    });
  } catch (err) {
    // [PRODUCTNAME] Observability must never crash the host app
    console.error('[PRODUCTNAME] Failed to send span to Kafka:', err);
  }
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
