import { Test, TestingModule } from '@nestjs/testing';
import { MongoDBClient } from './mongodb.client';
import { ActionQuery } from '../app.types';
import { MongoClient, Db, Collection } from 'mongodb';

// Mock mongodb
jest.mock('mongodb');

describe('MongoDBClient', () => {
  let client: MongoDBClient;
  let mockMongoClient: jest.Mocked<MongoClient>;
  let mockDb: jest.Mocked<Db>;
  let mockCollection: jest.Mocked<Collection>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MongoDBClient],
    }).compile();

    client = module.get<MongoDBClient>(MongoDBClient);

    mockCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ id: 1, name: 'John' }]),
      }),
      findOne: jest.fn().mockResolvedValue({ id: 1, name: 'John' }),
      insertOne: jest
        .fn()
        .mockResolvedValue({ insertedId: '123', acknowledged: true }),
      insertMany: jest.fn().mockResolvedValue({
        insertedIds: { 0: '123', 1: '456' },
        acknowledged: true,
      }),
      updateOne: jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1, acknowledged: true }),
      updateMany: jest
        .fn()
        .mockResolvedValue({ modifiedCount: 2, acknowledged: true }),
      deleteOne: jest
        .fn()
        .mockResolvedValue({ deletedCount: 1, acknowledged: true }),
      deleteMany: jest
        .fn()
        .mockResolvedValue({ deletedCount: 2, acknowledged: true }),
      aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ total: 100 }]),
      }),
      countDocuments: jest.fn().mockResolvedValue(10),
    } as any;

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    } as any;

    mockMongoClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    (MongoClient as unknown as jest.Mock).mockImplementation(
      () => mockMongoClient,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryDB', () => {
    it('should execute a find operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'find',
          collection: 'users',
          filter: { status: 'active' },
        }),
      };

      const result = await client.queryDB(query);

      expect(MongoClient).toHaveBeenCalledWith(query.connectionString);
      expect(mockMongoClient.connect).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.find).toHaveBeenCalledWith(
        { status: 'active' },
        {},
      );
      expect(mockMongoClient.close).toHaveBeenCalled();
      expect(result[0].query).toBe(query.command);
      expect(result[0].result).toEqual([{ id: 1, name: 'John' }]);
    });

    it('should execute a findOne operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'findOne',
          collection: 'users',
          filter: { id: 1 },
        }),
      };

      const result = await client.queryDB(query);

      expect(mockCollection.findOne).toHaveBeenCalledWith({ id: 1 }, {});
      expect(result[0].result).toEqual({ id: 1, name: 'John' });
    });

    it('should execute an insertOne operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'insertOne',
          collection: 'users',
          document: { name: 'John', email: 'john@example.com' },
        }),
      };

      const result = await client.queryDB(query);

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        name: 'John',
        email: 'john@example.com',
      });
      expect(result[0].result).toEqual({
        insertedId: '123',
        acknowledged: true,
      });
    });

    it('should execute an insertMany operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'insertMany',
          collection: 'users',
          document: [{ name: 'John' }, { name: 'Jane' }],
        }),
      };

      const result = await client.queryDB(query);

      expect(mockCollection.insertMany).toHaveBeenCalledWith([
        { name: 'John' },
        { name: 'Jane' },
      ]);
      expect(result[0].result).toEqual({
        insertedIds: { 0: '123', 1: '456' },
        acknowledged: true,
      });
    });

    it('should execute an updateOne operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'updateOne',
          collection: 'users',
          filter: { id: 1 },
          update: { $set: { name: 'John Updated' } },
        }),
      };

      const result = await client.queryDB(query);

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { id: 1 },
        { $set: { name: 'John Updated' } },
        {},
      );
      expect(result[0].result).toEqual({
        modifiedCount: 1,
        acknowledged: true,
      });
    });

    it('should execute an updateMany operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'updateMany',
          collection: 'users',
          filter: { status: 'inactive' },
          update: { $set: { status: 'active' } },
        }),
      };

      const result = await client.queryDB(query);

      expect(mockCollection.updateMany).toHaveBeenCalledWith(
        { status: 'inactive' },
        { $set: { status: 'active' } },
        {},
      );
      expect(result[0].result).toEqual({
        modifiedCount: 2,
        acknowledged: true,
      });
    });

    it('should execute a deleteOne operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'deleteOne',
          collection: 'users',
          filter: { id: 1 },
        }),
      };

      const result = await client.queryDB(query);

      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ id: 1 }, {});
      expect(result[0].result).toEqual({ deletedCount: 1, acknowledged: true });
    });

    it('should execute a deleteMany operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'deleteMany',
          collection: 'users',
          filter: { status: 'inactive' },
        }),
      };

      const result = await client.queryDB(query);

      expect(mockCollection.deleteMany).toHaveBeenCalledWith(
        { status: 'inactive' },
        {},
      );
      expect(result[0].result).toEqual({ deletedCount: 2, acknowledged: true });
    });

    it('should execute an aggregate operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'aggregate',
          collection: 'users',
          pipeline: [
            { $match: { status: 'active' } },
            { $group: { _id: null, total: { $sum: 1 } } },
          ],
        }),
      };

      const result = await client.queryDB(query);

      expect(mockCollection.aggregate).toHaveBeenCalledWith(
        [
          { $match: { status: 'active' } },
          { $group: { _id: null, total: { $sum: 1 } } },
        ],
        {},
      );
      expect(result[0].result).toEqual([{ total: 100 }]);
    });

    it('should execute a count operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'count',
          collection: 'users',
          filter: { status: 'active' },
        }),
      };

      const result = await client.queryDB(query);

      expect(mockCollection.countDocuments).toHaveBeenCalledWith(
        { status: 'active' },
        {},
      );
      expect(result[0].result).toBe(10);
    });

    it('should use database from operation if provided', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017',
        command: JSON.stringify({
          operation: 'find',
          database: 'customdb',
          collection: 'users',
        }),
      };

      await client.queryDB(query);

      expect(mockMongoClient.db).toHaveBeenCalledWith('customdb');
    });

    it('should extract database from connection string if not in operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/mydb',
        command: JSON.stringify({
          operation: 'find',
          collection: 'users',
        }),
      };

      await client.queryDB(query);

      expect(mockMongoClient.db).toHaveBeenCalledWith('mydb');
    });

    it('should default to test database if not specified', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017',
        command: JSON.stringify({
          operation: 'find',
          collection: 'users',
        }),
      };

      await client.queryDB(query);

      expect(mockMongoClient.db).toHaveBeenCalledWith('test');
    });

    it('should handle operation options', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'find',
          collection: 'users',
          filter: { status: 'active' },
          options: { limit: 10, sort: { name: 1 } },
        }),
      };

      await client.queryDB(query);

      expect(mockCollection.find).toHaveBeenCalledWith(
        { status: 'active' },
        { limit: 10, sort: { name: 1 } },
      );
    });

    it('should handle invalid JSON command', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: 'invalid json',
      };

      const result = await client.queryDB(query);

      expect(result[0].result).toContain('Unexpected token');
      expect(mockMongoClient.close).toHaveBeenCalled();
    });

    it('should handle unsupported operation', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'unsupported',
          collection: 'users',
        }),
      };

      const result = await client.queryDB(query);

      expect(result[0].result).toContain('Unsupported MongoDB operation');
      expect(mockMongoClient.close).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://invalid:connection',
        command: JSON.stringify({
          operation: 'find',
          collection: 'users',
        }),
      };

      const error = new Error('Connection failed');
      mockMongoClient.connect.mockRejectedValue(error);

      const result = await client.queryDB(query);

      expect(result[0].result).toBe('Connection failed');
      expect(mockMongoClient.close).toHaveBeenCalled();
    });

    it('should handle operation errors', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'find',
          collection: 'users',
        }),
      };

      const error = new Error('Operation failed');
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockRejectedValue(error),
      } as any);

      const result = await client.queryDB(query);

      expect(result[0].result).toBe('Operation failed');
      expect(mockMongoClient.close).toHaveBeenCalled();
    });

    it('should always close connection even on error', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'find',
          collection: 'users',
        }),
      };

      const error = new Error('Operation failed');
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockRejectedValue(error),
      } as any);

      await client.queryDB(query);

      expect(mockMongoClient.close).toHaveBeenCalled();
    });

    it('should handle insertOne with invalid document (array)', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'insertOne',
          collection: 'users',
          document: [{ name: 'John' }],
        }),
      };

      const result = await client.queryDB(query);

      expect(result[0].result).toContain(
        'insertOne requires a single document object',
      );
    });

    it('should handle insertMany with invalid document (not array)', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'insertMany',
          collection: 'users',
          document: { name: 'John' },
        }),
      };

      const result = await client.queryDB(query);

      expect(result[0].result).toContain(
        'insertMany requires an array of documents',
      );
    });

    it('should handle updateOne without filter', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'updateOne',
          collection: 'users',
          update: { $set: { name: 'John' } },
        }),
      };

      const result = await client.queryDB(query);

      expect(result[0].result).toContain(
        'updateOne requires filter and update fields',
      );
    });

    it('should handle aggregate without pipeline', async () => {
      const query: ActionQuery = {
        databaseType: 'mongodb',
        connectionString: 'mongodb://localhost:27017/testdb',
        command: JSON.stringify({
          operation: 'aggregate',
          collection: 'users',
        }),
      };

      const result = await client.queryDB(query);

      expect(result[0].result).toContain('aggregate requires a pipeline field');
    });
  });
});
