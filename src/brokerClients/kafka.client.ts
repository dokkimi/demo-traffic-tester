import { Injectable } from '@nestjs/common';
import { Kafka, logLevel } from 'kafkajs';

export interface KafkaProduceRequest {
  brokers: string[];
  topic: string;
  messages: Array<{
    key?: string;
    value: unknown;
  }>;
}

export interface KafkaConsumeRequest {
  brokers: string[];
  topic: string;
  groupId: string;
  count: number;
  fromBeginning?: boolean;
}

@Injectable()
export class KafkaClient {
  async produce(
    req: KafkaProduceRequest,
  ): Promise<{ produced: number }> {
    const kafka = new Kafka({
      clientId: 'traffic-tester',
      brokers: req.brokers,
      logLevel: logLevel.WARN,
    });

    const producer = kafka.producer();
    await producer.connect();

    await producer.send({
      topic: req.topic,
      messages: req.messages.map((m) => ({
        key: m.key ?? undefined,
        value:
          typeof m.value === 'string'
            ? m.value
            : JSON.stringify(m.value),
      })),
    });

    await producer.disconnect();
    return { produced: req.messages.length };
  }

  async consume(
    req: KafkaConsumeRequest,
  ): Promise<{ messages: unknown[] }> {
    const kafka = new Kafka({
      clientId: 'traffic-tester',
      brokers: req.brokers,
      logLevel: logLevel.WARN,
    });

    const consumer = kafka.consumer({ groupId: req.groupId });
    await consumer.connect();

    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    if (!topics.includes(req.topic)) {
      await admin.createTopics({
        topics: [{ topic: req.topic, numPartitions: 1 }],
      });
    }
    await admin.disconnect();

    await consumer.subscribe({
      topic: req.topic,
      fromBeginning: req.fromBeginning ?? true,
    });

    const messages: unknown[] = [];

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 15_000);

      consumer.run({
        eachMessage: async ({ message }) => {
          const val = message.value?.toString();
          try {
            messages.push(JSON.parse(val!));
          } catch {
            messages.push(val);
          }
          if (messages.length >= req.count) {
            clearTimeout(timer);
            resolve();
          }
        },
      });
    });

    await consumer.disconnect();
    return { messages };
  }
}
