import { Action } from './app.types';
import { MySQLClient } from './dbClients/mysql.client';
import { PostgresClient } from './dbClients/postgres.client';
import { MongoDBClient } from './dbClients/mongodb.client';
import { RedisClient } from './dbClients/redis.client';
import { AmqpClient } from './brokerClients/amqp.client';
import type {
  AmqpPublishRequest,
  AmqpPublishBatchRequest,
  AmqpConsumeRequest,
  AmqpSubscribeRequest,
  AmqpPublishRawRequest,
} from './brokerClients/amqp.client';
import { KafkaClient } from './brokerClients/kafka.client';
import type {
  KafkaProduceRequest,
  KafkaConsumeRequest,
} from './brokerClients/kafka.client';
import { All, Body, Controller, Get, Post, Res } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import * as express from 'express';

@Controller()
export class AppController {
  constructor(
    private readonly mysqlClient: MySQLClient,
    private readonly postgresClient: PostgresClient,
    private readonly mongodbClient: MongoDBClient,
    private readonly redisClient: RedisClient,
    private readonly amqpClient: AmqpClient,
    private readonly kafkaClient: KafkaClient,
  ) {}

  @Get('/health')
  public health() {
    return 'OK';
  }

  @Post('/amqp/publish')
  public async amqpPublish(@Body() body: AmqpPublishRequest) {
    return this.amqpClient.publish(body);
  }

  @Post('/amqp/publish-batch')
  public async amqpPublishBatch(@Body() body: AmqpPublishBatchRequest) {
    return this.amqpClient.publishBatch(body);
  }

  @Post('/amqp/consume')
  public async amqpConsume(@Body() body: AmqpConsumeRequest) {
    return this.amqpClient.consume(body);
  }

  @Post('/amqp/subscribe')
  public async amqpSubscribe(@Body() body: AmqpSubscribeRequest) {
    return this.amqpClient.subscribe(body);
  }

  @Post('/amqp/publish-raw')
  public async amqpPublishRaw(@Body() body: AmqpPublishRawRequest) {
    return this.amqpClient.publishRaw(body);
  }

  @Post('/kafka/produce')
  public async kafkaProduce(@Body() body: KafkaProduceRequest) {
    return this.kafkaClient.produce(body);
  }

  @Post('/kafka/consume')
  public async kafkaConsume(@Body() body: KafkaConsumeRequest) {
    return this.kafkaClient.consume(body);
  }

  @All('*')
  public async handleActions(
    @Body() body: unknown,
    @Res() res: express.Response,
  ): Promise<void> {
    const {
      requests = [],
      response = {},
      queries = [],
      preRequestLogs = [],
      postRequestLogs = [],
    } = (body ?? {}) as Action;
    (preRequestLogs ?? []).forEach((log) => console.log(log));

    const queryResults = await Promise.all(
      queries.map(async (query) => {
        try {
          switch (query.databaseType) {
            case 'mysql': {
              return await this.mysqlClient.queryDB(query);
            }
            case 'postgres': {
              return await this.postgresClient.queryDB(query);
            }
            case 'mongodb': {
              return await this.mongodbClient.queryDB(query);
            }
            case 'redis': {
              return await this.redisClient.queryDB(query);
            }
            default: {
              return null;
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          return [{ query: query.command || '', result: errorMessage }];
        }
      }),
    );

    const results = await Promise.all(
      requests.map(async (request) => {
        const serviceRequest = axios.create({ baseURL: request.baseURL });

        try {
          const config: AxiosRequestConfig = {
            method: request.method,
            url: request.url,
            headers: request.headers,
            data: request.data,
          };
          const response = await serviceRequest(config);
          return response.data;
        } catch (err) {
          if (axios.isAxiosError(err)) {
            return {
              code: err.code,
              message: err.message,
              status: err.response?.status,
              statusText: err.response?.statusText,
            };
          }
          return {
            message: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );

    (postRequestLogs ?? []).forEach((log) => console.log(log));

    if (response.headers) {
      res.set(response.headers);
    }

    res.status(response.status ?? 200).send(
      response.value ?? {
        queryResults,
        results,
      },
    );
  }
}
