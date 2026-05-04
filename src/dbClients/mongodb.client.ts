import { ActionQuery } from '../app.types';
import { IDatabaseQueryResult } from '../types/IDatabaseQueryResult';
import { Injectable } from '@nestjs/common';
import { MongoClient, Db, Collection } from 'mongodb';

interface MongoDBOperation {
  operation:
    | 'find'
    | 'findOne'
    | 'insertOne'
    | 'insertMany'
    | 'updateOne'
    | 'updateMany'
    | 'deleteOne'
    | 'deleteMany'
    | 'aggregate'
    | 'count';
  database?: string;
  collection: string;
  filter?: Record<string, unknown>;
  document?: Record<string, unknown> | Record<string, unknown>[];
  update?: Record<string, unknown>;
  options?: Record<string, unknown>;
  pipeline?: Record<string, unknown>[];
}

@Injectable()
export class MongoDBClient {
  public async queryDB(
    databaseQuery: ActionQuery,
  ): Promise<IDatabaseQueryResult[]> {
    const { connectionString, command } = databaseQuery;
    let client: MongoClient | null = null;

    try {
      // Parse the command as JSON
      const operation: MongoDBOperation = JSON.parse(command);

      // Connect to MongoDB
      client = new MongoClient(connectionString);
      await client.connect();

      // Determine database (from operation or connection string)
      const dbName =
        operation.database ||
        this.extractDatabaseFromConnectionString(connectionString);
      const db: Db = client.db(dbName);
      const collection: Collection = db.collection(operation.collection);

      let result: unknown;

      switch (operation.operation) {
        case 'find':
          result = await collection
            .find(operation.filter || {}, operation.options || {})
            .toArray();
          break;

        case 'findOne':
          result = await collection.findOne(
            operation.filter || {},
            operation.options || {},
          );
          break;

        case 'insertOne':
          if (!operation.document || Array.isArray(operation.document)) {
            throw new Error('insertOne requires a single document object');
          }
          result = await collection.insertOne(operation.document);
          break;

        case 'insertMany':
          if (!operation.document || !Array.isArray(operation.document)) {
            throw new Error('insertMany requires an array of documents');
          }
          result = await collection.insertMany(
            operation.document as Record<string, unknown>[],
          );
          break;

        case 'updateOne':
          if (!operation.filter || !operation.update) {
            throw new Error('updateOne requires filter and update fields');
          }
          result = await collection.updateOne(
            operation.filter,
            operation.update,
            operation.options || {},
          );
          break;

        case 'updateMany':
          if (!operation.filter || !operation.update) {
            throw new Error('updateMany requires filter and update fields');
          }
          result = await collection.updateMany(
            operation.filter,
            operation.update,
            operation.options || {},
          );
          break;

        case 'deleteOne':
          if (!operation.filter) {
            throw new Error('deleteOne requires a filter field');
          }
          result = await collection.deleteOne(
            operation.filter,
            operation.options || {},
          );
          break;

        case 'deleteMany':
          if (!operation.filter) {
            throw new Error('deleteMany requires a filter field');
          }
          result = await collection.deleteMany(
            operation.filter,
            operation.options || {},
          );
          break;

        case 'aggregate':
          if (!operation.pipeline) {
            throw new Error('aggregate requires a pipeline field');
          }
          result = await collection
            .aggregate(operation.pipeline, operation.options || {})
            .toArray();
          break;

        case 'count':
          result = await collection.countDocuments(
            operation.filter || {},
            operation.options || {},
          );
          break;

        default:
          throw new Error(
            `Unsupported MongoDB operation: ${operation.operation}`,
          );
      }

      return [{ query: command, result }];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return [{ query: command, result: errorMessage }];
    } finally {
      if (client) {
        await client.close();
      }
    }
  }

  private extractDatabaseFromConnectionString(
    connectionString: string,
  ): string {
    // Extract database name from MongoDB connection string
    // Format: mongodb://[username:password@]host[:port][/database][?options]
    const match = connectionString.match(/mongodb:\/\/[^/]+\/([^?]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // Default to 'test' if no database specified
    return 'test';
  }
}
