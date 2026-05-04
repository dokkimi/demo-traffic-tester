import { AppController } from './app.controller';
import { MySQLClient } from './dbClients/mysql.client';
import { PostgresClient } from './dbClients/postgres.client';
import { MongoDBClient } from './dbClients/mongodb.client';
import { RedisClient } from './dbClients/redis.client';
import { Module } from '@nestjs/common';

@Module({
  controllers: [AppController],
  providers: [MySQLClient, PostgresClient, MongoDBClient, RedisClient],
})
export class AppModule {}
