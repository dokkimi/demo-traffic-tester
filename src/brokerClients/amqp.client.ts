import { Injectable } from '@nestjs/common';
import * as amqplib from 'amqplib';

export interface AmqpPublishRequest {
  connectionString: string;
  exchange: string;
  exchangeType?: string;
  routingKey: string;
  message: unknown;
  bindQueue?: string;
}

export interface AmqpPublishBatchRequest {
  connectionString: string;
  exchange: string;
  exchangeType?: string;
  routingKey: string;
  messages: unknown[];
}

export interface AmqpConsumeRequest {
  connectionString: string;
  queue: string;
  bindExchange?: string;
  bindRoutingKey?: string;
  count: number;
}

export interface AmqpSubscribeRequest {
  connectionString: string;
  queue: string;
  count: number;
}

export interface AmqpPublishRawRequest {
  connectionString: string;
  exchange: string;
  routingKey: string;
  body: string;
  contentType?: string;
}

@Injectable()
export class AmqpClient {
  async publish(req: AmqpPublishRequest): Promise<{ published: boolean }> {
    const conn = await amqplib.connect(req.connectionString);
    const ch = await conn.createChannel();

    if (req.exchange) {
      await ch.assertExchange(req.exchange, req.exchangeType || 'direct', {
        durable: false,
      });
      if (req.bindQueue) {
        await ch.assertQueue(req.bindQueue, { durable: false });
        await ch.bindQueue(req.bindQueue, req.exchange, req.routingKey);
      }
    }

    if (!req.exchange) {
      await ch.assertQueue(req.routingKey, { durable: false });
    }

    const body = Buffer.from(JSON.stringify(req.message));
    ch.publish(req.exchange, req.routingKey, body, {
      contentType: 'application/json',
    });

    await ch.close();
    await conn.close();
    return { published: true };
  }

  async publishBatch(
    req: AmqpPublishBatchRequest,
  ): Promise<{ published: number }> {
    const conn = await amqplib.connect(req.connectionString);
    const ch = await conn.createChannel();

    if (req.exchange) {
      await ch.assertExchange(req.exchange, req.exchangeType || 'direct', {
        durable: false,
      });
    }

    if (!req.exchange) {
      await ch.assertQueue(req.routingKey, { durable: false });
    }

    for (const msg of req.messages) {
      const body = Buffer.from(JSON.stringify(msg));
      ch.publish(req.exchange, req.routingKey, body, {
        contentType: 'application/json',
      });
    }

    await ch.close();
    await conn.close();
    return { published: req.messages.length };
  }

  async consume(
    req: AmqpConsumeRequest,
  ): Promise<{ messages: unknown[] }> {
    const conn = await amqplib.connect(req.connectionString);
    const ch = await conn.createChannel();

    await ch.assertQueue(req.queue, { durable: false });

    if (req.bindExchange && req.bindRoutingKey) {
      await ch.assertExchange(req.bindExchange, 'topic', { durable: false });
      await ch.bindQueue(req.queue, req.bindExchange, req.bindRoutingKey);
    }

    const messages: unknown[] = [];
    const deadline = Date.now() + 10_000;

    while (messages.length < req.count && Date.now() < deadline) {
      const msg = await ch.get(req.queue, { noAck: true });
      if (msg) {
        try {
          messages.push(JSON.parse(msg.content.toString()));
        } catch {
          messages.push(msg.content.toString());
        }
      } else {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    await ch.close();
    await conn.close();
    return { messages };
  }

  async subscribe(
    req: AmqpSubscribeRequest,
  ): Promise<{ messages: unknown[] }> {
    const conn = await amqplib.connect(req.connectionString);
    const ch = await conn.createChannel();

    await ch.assertQueue(req.queue, { durable: false });

    const messages: unknown[] = [];

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 10_000);

      ch.consume(
        req.queue,
        (msg) => {
          if (msg) {
            ch.ack(msg);
            try {
              messages.push(JSON.parse(msg.content.toString()));
            } catch {
              messages.push(msg.content.toString());
            }
            if (messages.length >= req.count) {
              clearTimeout(timer);
              resolve();
            }
          }
        },
        { noAck: false },
      );
    });

    await ch.close();
    await conn.close();
    return { messages };
  }

  async publishRaw(
    req: AmqpPublishRawRequest,
  ): Promise<{ published: boolean }> {
    const conn = await amqplib.connect(req.connectionString);
    const ch = await conn.createChannel();

    if (!req.exchange) {
      await ch.assertQueue(req.routingKey, { durable: false });
    }

    const body = Buffer.from(req.body, 'utf-8');
    ch.publish(req.exchange, req.routingKey, body, {
      contentType: req.contentType || 'text/plain',
    });

    await ch.close();
    await conn.close();
    return { published: true };
  }
}
