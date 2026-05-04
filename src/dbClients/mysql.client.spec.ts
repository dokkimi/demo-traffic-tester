import { Test, TestingModule } from '@nestjs/testing';
import { MySQLClient } from './mysql.client';
import { ActionQuery } from '../app.types';
import mysql from 'mysql2/promise';

// Mock mysql2
jest.mock('mysql2/promise');

describe('MySQLClient', () => {
  let client: MySQLClient;
  let mockConnection: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MySQLClient],
    }).compile();

    client = module.get<MySQLClient>(MySQLClient);

    mockConnection = {
      execute: jest.fn(),
      end: jest.fn(),
    };

    (mysql.createConnection as jest.Mock).mockResolvedValue(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryDB', () => {
    it('should execute a single query successfully', async () => {
      const query: ActionQuery = {
        databaseType: 'mysql',
        connectionString: 'mysql://user:pass@localhost:3306/db',
        command: 'SELECT * FROM users;',
      };

      const mockResult = [{ id: 1, name: 'John' }];
      mockConnection.execute.mockResolvedValue([mockResult, []]);

      const result = await client.queryDB(query);

      expect(mysql.createConnection).toHaveBeenCalledWith(
        query.connectionString,
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT * FROM users',
      );
      expect(mockConnection.end).toHaveBeenCalled();
      expect(result).toEqual([
        {
          query: 'SELECT * FROM users',
          result: mockResult,
        },
      ]);
    });

    it('should handle multiple queries and execute the last one', async () => {
      const query: ActionQuery = {
        databaseType: 'mysql',
        connectionString: 'mysql://user:pass@localhost:3306/db',
        command: 'SELECT 1; SELECT 2; SELECT 3;',
      };

      const mockResult = [3];
      mockConnection.execute.mockResolvedValue([mockResult, []]);

      const result = await client.queryDB(query);

      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT 3');
      expect(result).toEqual([
        {
          query: 'SELECT 3',
          result: mockResult,
        },
      ]);
    });

    it('should handle queries with whitespace', async () => {
      const query: ActionQuery = {
        databaseType: 'mysql',
        connectionString: 'mysql://user:pass@localhost:3306/db',
        command: '  SELECT * FROM users;  ',
      };

      const mockResult = [{ id: 1 }];
      mockConnection.execute.mockResolvedValue([mockResult, []]);

      const result = await client.queryDB(query);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT * FROM users',
      );
      expect(result).toEqual([
        {
          query: 'SELECT * FROM users',
          result: mockResult,
        },
      ]);
    });

    it('should handle empty queries', async () => {
      const query: ActionQuery = {
        databaseType: 'mysql',
        connectionString: 'mysql://user:pass@localhost:3306/db',
        command: '   ;  ;  ',
      };

      const mockResult = [];
      mockConnection.execute.mockResolvedValue([mockResult, []]);

      const result = await client.queryDB(query);

      // Should not execute anything if no valid query
      expect(mockConnection.execute).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle query errors', async () => {
      const query: ActionQuery = {
        databaseType: 'mysql',
        connectionString: 'mysql://user:pass@localhost:3306/db',
        command: 'SELECT * FROM nonexistent;',
      };

      const error = new Error('Table does not exist');
      mockConnection.execute.mockRejectedValue(error);

      const result = await client.queryDB(query);

      expect(mockConnection.execute).toHaveBeenCalled();
      expect(mockConnection.end).toHaveBeenCalled();
      expect(result).toEqual([
        {
          query: 'SELECT * FROM nonexistent',
          result: 'Table does not exist',
        },
      ]);
    });

    it('should handle connection errors', async () => {
      const query: ActionQuery = {
        databaseType: 'mysql',
        connectionString: 'mysql://invalid:connection',
        command: 'SELECT 1;',
      };

      const error = new Error('Connection failed');
      (mysql.createConnection as jest.Mock).mockRejectedValue(error);

      await expect(client.queryDB(query)).rejects.toThrow('Connection failed');
    });

    it('should always close connection even on error', async () => {
      const query: ActionQuery = {
        databaseType: 'mysql',
        connectionString: 'mysql://user:pass@localhost:3306/db',
        command: 'SELECT * FROM users;',
      };

      const error = new Error('Query failed');
      mockConnection.execute.mockRejectedValue(error);

      await client.queryDB(query);

      expect(mockConnection.end).toHaveBeenCalled();
    });

    it('should handle INSERT queries', async () => {
      const query: ActionQuery = {
        databaseType: 'mysql',
        connectionString: 'mysql://user:pass@localhost:3306/db',
        command: 'INSERT INTO users (name) VALUES ("John");',
      };

      const mockResult = { insertId: 1, affectedRows: 1 };
      mockConnection.execute.mockResolvedValue([mockResult, []]);

      const result = await client.queryDB(query);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT INTO users (name) VALUES ("John")',
      );
      expect(result).toEqual([
        {
          query: 'INSERT INTO users (name) VALUES ("John")',
          result: mockResult,
        },
      ]);
    });
  });
});
