import { Test, TestingModule } from '@nestjs/testing';
import { PostgresClient } from './postgres.client';
import { ActionQuery } from '../app.types';
import { Client } from 'pg';

// Mock pg
jest.mock('pg');

describe('PostgresClient', () => {
  let client: PostgresClient;
  let mockClient: {
    connect: jest.Mock;
    query: jest.Mock;
    end: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostgresClient],
    }).compile();

    client = module.get<PostgresClient>(PostgresClient);

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      end: jest.fn().mockResolvedValue(undefined),
    };

    (Client as unknown as jest.Mock).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryDB', () => {
    it('should execute a single query successfully', async () => {
      const query: ActionQuery = {
        databaseType: 'postgres',
        connectionString: 'postgresql://user:pass@localhost:5432/db',
        command: 'SELECT * FROM users;',
      };

      const mockRows = [{ id: 1, name: 'John' }];
      mockClient.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await client.queryDB(query);

      expect(Client).toHaveBeenCalledWith(query.connectionString);
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users;');
      expect(mockClient.end).toHaveBeenCalled();
      expect(result).toEqual([
        {
          query: 'SELECT * FROM users;',
          result: mockRows,
        },
      ]);
    });

    it('should handle multiple queries and execute the last one', async () => {
      const query: ActionQuery = {
        databaseType: 'postgres',
        connectionString: 'postgresql://user:pass@localhost:5432/db',
        command: 'SELECT 1; SELECT 2; SELECT 3;',
      };

      const mockRows = [3];
      mockClient.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await client.queryDB(query);

      expect(mockClient.query).toHaveBeenCalledWith('SELECT 3;');
      expect(result).toEqual([
        {
          query: 'SELECT 3;',
          result: mockRows,
        },
      ]);
    });

    it('should handle queries with whitespace', async () => {
      const query: ActionQuery = {
        databaseType: 'postgres',
        connectionString: 'postgresql://user:pass@localhost:5432/db',
        command: '  SELECT * FROM users;  ',
      };

      const mockRows = [{ id: 1 }];
      mockClient.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await client.queryDB(query);

      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users;');
      expect(result).toEqual([
        {
          query: 'SELECT * FROM users;',
          result: mockRows,
        },
      ]);
    });

    it('should handle empty queries', async () => {
      const query: ActionQuery = {
        databaseType: 'postgres',
        connectionString: 'postgresql://user:pass@localhost:5432/db',
        command: '   ;  ;  ',
      };

      const result = await client.queryDB(query);

      // Should not execute anything if no valid query
      expect(mockClient.query).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle query errors', async () => {
      const query: ActionQuery = {
        databaseType: 'postgres',
        connectionString: 'postgresql://user:pass@localhost:5432/db',
        command: 'SELECT * FROM nonexistent;',
      };

      const error = new Error('relation "nonexistent" does not exist');
      mockClient.query.mockRejectedValue(error);

      const result = await client.queryDB(query);

      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.end).toHaveBeenCalled();
      expect(result).toEqual([
        {
          query: 'SELECT * FROM nonexistent;',
          result: 'relation "nonexistent" does not exist',
        },
      ]);
    });

    it('should handle connection errors', async () => {
      const query: ActionQuery = {
        databaseType: 'postgres',
        connectionString: 'postgresql://invalid:connection',
        command: 'SELECT 1;',
      };

      const error = new Error('Connection failed');
      mockClient.connect.mockRejectedValue(error);

      await expect(client.queryDB(query)).rejects.toThrow('Connection failed');
    });

    it('should always close connection even on error', async () => {
      const query: ActionQuery = {
        databaseType: 'postgres',
        connectionString: 'postgresql://user:pass@localhost:5432/db',
        command: 'SELECT * FROM users;',
      };

      const error = new Error('Query failed');
      mockClient.query.mockRejectedValue(error);

      await client.queryDB(query);

      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should handle INSERT queries', async () => {
      const query: ActionQuery = {
        databaseType: 'postgres',
        connectionString: 'postgresql://user:pass@localhost:5432/db',
        command: 'INSERT INTO users (name) VALUES ($1);',
      };

      const mockRows = [{ id: 1 }];
      mockClient.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await client.queryDB(query);

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO users (name) VALUES ($1);',
      );
      expect(result).toEqual([
        {
          query: 'INSERT INTO users (name) VALUES ($1);',
          result: mockRows,
        },
      ]);
    });

    it('should add semicolon to queries', async () => {
      const query: ActionQuery = {
        databaseType: 'postgres',
        connectionString: 'postgresql://user:pass@localhost:5432/db',
        command: 'SELECT 1',
      };

      const mockRows = [1];
      mockClient.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await client.queryDB(query);

      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1;');
      expect(result).toEqual([
        {
          query: 'SELECT 1;',
          result: mockRows,
        },
      ]);
    });

    it('should handle UPDATE queries', async () => {
      const query: ActionQuery = {
        databaseType: 'postgres',
        connectionString: 'postgresql://user:pass@localhost:5432/db',
        command: 'UPDATE users SET name = $1 WHERE id = $2;',
      };

      const mockRows = [];
      mockClient.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await client.queryDB(query);

      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE users SET name = $1 WHERE id = $2;',
      );
      expect(result).toEqual([
        {
          query: 'UPDATE users SET name = $1 WHERE id = $2;',
          result: mockRows,
        },
      ]);
    });
  });
});
