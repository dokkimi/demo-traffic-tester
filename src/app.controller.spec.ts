import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { MySQLClient } from './dbClients/mysql.client';
import { PostgresClient } from './dbClients/postgres.client';
import { MongoDBClient } from './dbClients/mongodb.client';
import { RedisClient } from './dbClients/redis.client';
import { AmqpClient } from './brokerClients/amqp.client';
import { KafkaClient } from './brokerClients/kafka.client';
import { Action } from './app.types';
import axios from 'axios';
import { Response } from 'express';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AppController', () => {
  let controller: AppController;
  let mockResponse: Partial<Response>;

  const mockMySQLClient = {
    queryDB: jest.fn(),
  };

  const mockPostgresClient = {
    queryDB: jest.fn(),
  };

  const mockMongoDBClient = {
    queryDB: jest.fn(),
  };

  const mockRedisClient = {
    queryDB: jest.fn(),
  };

  const mockAmqpClient = {
    publish: jest.fn(),
    publishBatch: jest.fn(),
    consume: jest.fn(),
  };

  const mockKafkaClient = {
    produce: jest.fn(),
    consume: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: MySQLClient,
          useValue: mockMySQLClient,
        },
        {
          provide: PostgresClient,
          useValue: mockPostgresClient,
        },
        {
          provide: MongoDBClient,
          useValue: mockMongoDBClient,
        },
        {
          provide: RedisClient,
          useValue: mockRedisClient,
        },
        {
          provide: AmqpClient,
          useValue: mockAmqpClient,
        },
        {
          provide: KafkaClient,
          useValue: mockKafkaClient,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);

    mockResponse = {
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    jest.clearAllMocks();
    console.log = jest.fn(); // Mock console.log
  });

  describe('health', () => {
    it('should return "OK"', () => {
      expect(controller.health()).toBe('OK');
    });
  });

  describe('handleActions', () => {
    it('should handle empty action', async () => {
      const action: Action = {};

      await controller.handleActions(action, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith({
        queryResults: [],
        results: [],
      });
    });

    it('should handle preRequestLogs and postRequestLogs', async () => {
      const action: Action = {
        preRequestLogs: ['Pre-log 1', 'Pre-log 2'],
        postRequestLogs: ['Post-log 1'],
      };

      await controller.handleActions(action, mockResponse as Response);

      expect(console.log).toHaveBeenCalledWith('Pre-log 1');
      expect(console.log).toHaveBeenCalledWith('Pre-log 2');
      expect(console.log).toHaveBeenCalledWith('Post-log 1');
    });

    it('should execute MySQL queries', async () => {
      const action: Action = {
        queries: [
          {
            databaseType: 'mysql',
            connectionString: 'mysql://user:pass@localhost:3306/db',
            command: 'SELECT * FROM users;',
          },
        ],
      };

      const mockQueryResult = [
        {
          query: 'SELECT * FROM users',
          result: [{ id: 1, name: 'John' }],
        },
      ];

      mockMySQLClient.queryDB.mockResolvedValue(mockQueryResult);

      await controller.handleActions(action, mockResponse as Response);

      expect(mockMySQLClient.queryDB).toHaveBeenCalledWith(action.queries?.[0]);
      expect(mockResponse.send).toHaveBeenCalledWith({
        queryResults: [mockQueryResult],
        results: [],
      });
    });

    it('should execute PostgreSQL queries', async () => {
      const action: Action = {
        queries: [
          {
            databaseType: 'postgres',
            connectionString: 'postgresql://user:pass@localhost:5432/db',
            command: 'SELECT * FROM products;',
          },
        ],
      };

      const mockQueryResult = [
        {
          query: 'SELECT * FROM products;',
          result: [{ id: 1, name: 'Product 1' }],
        },
      ];

      mockPostgresClient.queryDB.mockResolvedValue(mockQueryResult);

      await controller.handleActions(action, mockResponse as Response);

      expect(mockPostgresClient.queryDB).toHaveBeenCalledWith(
        action.queries?.[0],
      );
      expect(mockResponse.send).toHaveBeenCalledWith({
        queryResults: [mockQueryResult],
        results: [],
      });
    });

    it('should handle multiple queries in parallel', async () => {
      const action: Action = {
        queries: [
          {
            databaseType: 'mysql',
            connectionString: 'mysql://localhost/db1',
            command: 'SELECT 1;',
          },
          {
            databaseType: 'postgres',
            connectionString: 'postgresql://localhost/db2',
            command: 'SELECT 2;',
          },
        ],
      };

      mockMySQLClient.queryDB.mockResolvedValue([
        { query: 'SELECT 1', result: 1 },
      ]);
      mockPostgresClient.queryDB.mockResolvedValue([
        { query: 'SELECT 2;', result: 2 },
      ]);

      await controller.handleActions(action, mockResponse as Response);

      expect(mockMySQLClient.queryDB).toHaveBeenCalled();
      expect(mockPostgresClient.queryDB).toHaveBeenCalled();
    });

    it('should execute HTTP requests', async () => {
      const action: Action = {
        requests: [
          {
            method: 'GET',
            baseURL: 'https://api.example.com',
            url: '/users',
            data: {},
          },
        ],
      };

      const mockAxiosInstance = {
        request: jest.fn().mockResolvedValue({
          data: { users: [{ id: 1, name: 'John' }] },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      await controller.handleActions(action, mockResponse as Response);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
      });
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/users',
        headers: undefined,
        data: {},
      });
      expect(mockResponse.send).toHaveBeenCalledWith({
        queryResults: [],
        results: [{ users: [{ id: 1, name: 'John' }] }],
      });
    });

    it('should handle HTTP request errors', async () => {
      const action: Action = {
        requests: [
          {
            method: 'GET',
            baseURL: 'https://api.example.com',
            url: '/error',
            data: {},
          },
        ],
      };

      const mockAxiosInstance = {
        request: jest.fn().mockRejectedValue({
          code: 'ECONNREFUSED',
          message: 'Connection refused',
          response: {
            status: 500,
            statusText: 'Internal Server Error',
          },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
      (mockedAxios.isAxiosError as unknown as jest.Mock) = jest
        .fn()
        .mockReturnValue(true);

      await controller.handleActions(action, mockResponse as Response);

      expect(mockResponse.send).toHaveBeenCalledWith({
        queryResults: [],
        results: [
          {
            code: 'ECONNREFUSED',
            message: 'Connection refused',
            status: 500,
            statusText: 'Internal Server Error',
          },
        ],
      });
    });

    it('should handle non-Axios errors', async () => {
      const action: Action = {
        requests: [
          {
            method: 'GET',
            baseURL: 'https://api.example.com',
            url: '/error',
            data: {},
          },
        ],
      };

      const mockAxiosInstance = {
        request: jest.fn().mockRejectedValue(new Error('Generic error')),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
      (mockedAxios.isAxiosError as unknown as jest.Mock) = jest
        .fn()
        .mockReturnValue(false);

      await controller.handleActions(action, mockResponse as Response);

      expect(mockResponse.send).toHaveBeenCalledWith({
        queryResults: [],
        results: [
          {
            message: 'Generic error',
          },
        ],
      });
    });

    it('should handle recursive HTTP requests', async () => {
      const nestedAction: Action = {
        requests: [
          {
            method: 'POST',
            baseURL: 'http://service-b:4000',
            url: '/process',
            data: {},
          },
        ],
      };

      const action: Action = {
        requests: [
          {
            method: 'POST',
            baseURL: 'http://service-a:4000',
            url: '/test',
            data: nestedAction,
          },
        ],
      };

      const mockAxiosInstance = {
        request: jest.fn().mockResolvedValue({
          data: { processed: true },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      await controller.handleActions(action, mockResponse as Response);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/test',
        headers: undefined,
        data: nestedAction, // The nested action is sent as data
      });
    });

    it('should use custom response when provided', async () => {
      const action: Action = {
        response: {
          status: 201,
          headers: { 'X-Custom': 'value' },
          value: { custom: 'response' },
        },
      };

      await controller.handleActions(action, mockResponse as Response);

      expect(mockResponse.set).toHaveBeenCalledWith({ 'X-Custom': 'value' });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.send).toHaveBeenCalledWith({ custom: 'response' });
    });

    it('should execute queries and requests in parallel', async () => {
      const action: Action = {
        queries: [
          {
            databaseType: 'mysql',
            connectionString: 'mysql://localhost/db',
            command: 'SELECT 1;',
          },
        ],
        requests: [
          {
            method: 'GET',
            baseURL: 'https://api.example.com',
            url: '/data',
            data: {},
          },
        ],
      };

      mockMySQLClient.queryDB.mockResolvedValue([
        { query: 'SELECT 1', result: 1 },
      ]);

      const mockAxiosInstance = {
        request: jest.fn().mockResolvedValue({
          data: { data: 'test' },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      await controller.handleActions(action, mockResponse as Response);

      expect(mockMySQLClient.queryDB).toHaveBeenCalled();
      expect(mockAxiosInstance.request).toHaveBeenCalled();
      expect(mockResponse.send).toHaveBeenCalledWith({
        queryResults: [[{ query: 'SELECT 1', result: 1 }]],
        results: [{ data: 'test' }],
      });
    });

    it('should execute MongoDB queries', async () => {
      const action: Action = {
        queries: [
          {
            databaseType: 'mongodb',
            connectionString: 'mongodb://localhost:27017/testdb',
            command: JSON.stringify({
              operation: 'find',
              collection: 'users',
              filter: { status: 'active' },
            }),
          },
        ],
      };

      const mockQueryResult = [
        {
          query: action.queries?.[0].command,
          result: [{ id: 1, name: 'John', status: 'active' }],
        },
      ];

      mockMongoDBClient.queryDB.mockResolvedValue(mockQueryResult);

      await controller.handleActions(action, mockResponse as Response);

      expect(mockMongoDBClient.queryDB).toHaveBeenCalledWith(
        action.queries?.[0],
      );
      expect(mockResponse.send).toHaveBeenCalledWith({
        queryResults: [mockQueryResult],
        results: [],
      });
    });

    it('should handle unknown database type', async () => {
      const action: Action = {
        queries: [
          {
            databaseType: 'unknown',
            connectionString: 'unknown://localhost/db',
            command: 'SELECT 1;',
          },
        ],
      };

      await controller.handleActions(action, mockResponse as Response);

      expect(mockMySQLClient.queryDB).not.toHaveBeenCalled();
      expect(mockPostgresClient.queryDB).not.toHaveBeenCalled();
      expect(mockMongoDBClient.queryDB).not.toHaveBeenCalled();
      expect(mockResponse.send).toHaveBeenCalledWith({
        queryResults: [null],
        results: [],
      });
    });
  });
});
