# Traffic Tester

## Overview

Traffic Tester is a NestJS-based service that acts as a **recursive HTTP sender** for testing distributed systems. It receives test configurations containing HTTP requests and database queries, executes them (potentially recursively), and returns the combined results. The tool is designed to be called by testing infrastructure to run complex test suites that involve multiple services and database operations.

## Key Feature: Recursive HTTP Sender

The core feature of Traffic Tester is its ability to execute **recursive HTTP requests**. This means:

1. You send an HTTP request to Traffic Tester containing an `Action` payload
2. The `Action` can contain multiple HTTP `requests`
3. Each HTTP `request` has a `data` field that is itself an `Action`
4. When Traffic Tester executes a request, it sends the nested `Action` to the target service
5. If that target service is also a Traffic Tester instance (or compatible service), it will execute the nested `Action`, which may contain even more nested requests
6. This creates a recursive execution chain that can span multiple services

This recursive pattern enables:

- **Distributed test execution**: Test scenarios that require coordination across multiple services
- **Cascading operations**: Operations that trigger other operations in a chain
- **Complex workflows**: Multi-step processes that involve multiple services
- **Service orchestration**: Coordinating actions across a distributed system

## Architecture

- **Framework**: NestJS 11.x with TypeScript
- **Database Clients**: MySQL (via `mysql2`), PostgreSQL (via `pg`), and MongoDB (via `mongodb`)
- **HTTP Client**: Axios
- **Port**: 4000 (default)

## How It Works

### 1. Request Flow

```
Client → Traffic Tester → Target Service(s) → (potentially more Traffic Testers)
```

1. A client sends an HTTP request to Traffic Tester with an `Action` payload
2. Traffic Tester processes the `Action`:
   - Executes database queries (if any)
   - Executes HTTP requests (if any)
   - Each HTTP request's `data` field contains another `Action` that gets sent to the target service
3. If the target service is another Traffic Tester instance, it recursively processes the nested `Action`
4. Results are collected and returned

### 2. Action Structure

An `Action` is a JSON object that can contain:

- **`requests`**: Array of HTTP requests to execute
- **`queries`**: Array of database queries to execute
- **`response`**: Custom response configuration
- **`preRequestLogs`**: Logs to output before executing requests
- **`postRequestLogs`**: Logs to output after executing requests

### 3. Recursive Execution Example

Here's how recursion works:

```json
{
  "requests": [
    {
      "method": "POST",
      "baseURL": "http://service-a:4000",
      "url": "/test",
      "data": {
        "requests": [
          {
            "method": "GET",
            "baseURL": "http://service-b:4000",
            "url": "/data",
            "data": {
              "requests": [
                {
                  "method": "POST",
                  "baseURL": "http://service-c:4000",
                  "url": "/process",
                  "data": {}
                }
              ]
            }
          }
        ]
      }
    }
  ]
}
```

Execution flow:

1. Traffic Tester receives the outer `Action`
2. It sends a POST to `service-a:4000/test` with the nested `Action` as the body
3. If `service-a` is a Traffic Tester, it processes the nested `Action`:
   - Sends a GET to `service-b:4000/data` with another nested `Action`
   - If `service-b` is a Traffic Tester, it processes that `Action`:
     - Sends a POST to `service-c:4000/process`
4. Results bubble back up through the chain

## API Endpoints

### Health Check

- **`GET /health`** - Returns `"OK"` to verify the service is running

### Test Execution

- **`ALL /*`** - Catch-all endpoint that accepts test actions on any path
  - **Method**: Any HTTP method (GET, POST, PUT, DELETE, etc.)
  - **Body**: `Action` JSON object

## Request/Response Format

### Input (Action)

```typescript
{
  // Optional: Logs to output before processing
  preRequestLogs?: string[];

  // Optional: HTTP requests to execute
  requests?: [
    {
      method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | ...,
      baseURL: string,        // Base URL of target service
      url: string,            // Path/endpoint on target service
      headers?: Record<string, string>,  // Optional headers
      data: Action            // ⚠️ NESTED ACTION - This enables recursion!
    }
  ],

  // Optional: Database queries to execute
  queries?: [
    {
      databaseType: "mysql" | "postgres" | "mongodb",
      connectionString: string,  // Database connection string
      command: string            // SQL query (MySQL/PostgreSQL) or JSON operation (MongoDB)
    }
  ],

  // Optional: Logs to output after processing
  postRequestLogs?: string[];

  // Optional: Custom response configuration
  response?: {
    status?: number,                    // HTTP status code
    headers?: Record<string, string>,    // Response headers
    value?: any                         // Custom response body (overrides default)
  }
}
```

### Output

If `response.value` is provided, returns that value directly.

Otherwise, returns:

```json
{
  "queryResults": [
    {
      "query": "SELECT * FROM users",
      "result": [...]
    }
  ],
  "results": [
    {
      // Response data from HTTP request
    }
  ]
}
```

## Usage Examples

### Example 1: Simple Single Request

```bash
curl -X POST http://localhost:4000/test \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "method": "GET",
        "baseURL": "https://api.example.com",
        "url": "/users",
        "data": {}
      }
    ]
  }'
```

### Example 2: Recursive Request Chain

```bash
curl -X POST http://localhost:4000/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "preRequestLogs": ["Starting orchestration"],
    "requests": [
      {
        "method": "POST",
        "baseURL": "http://service-a:4000",
        "url": "/step1",
        "data": {
          "requests": [
            {
              "method": "POST",
              "baseURL": "http://service-b:4000",
              "url": "/step2",
              "data": {
                "requests": [
                  {
                    "method": "GET",
                    "baseURL": "http://service-c:4000",
                    "url": "/step3",
                    "data": {}
                  }
                ]
              }
            }
          ]
        }
      }
    ],
    "postRequestLogs": ["Orchestration complete"]
  }'
```

### Example 3: With Database Queries

```bash
curl -X POST http://localhost:4000/test-with-db \
  -H "Content-Type: application/json" \
  -d '{
    "queries": [
      {
        "databaseType": "postgres",
        "connectionString": "postgresql://user:pass@localhost:5432/mydb",
        "command": "SELECT * FROM users WHERE active = true;"
      }
    ],
    "requests": [
      {
        "method": "POST",
        "baseURL": "http://api-service:4000",
        "url": "/process-users",
        "data": {
          "response": {
            "status": 200,
            "value": "Processing complete"
          }
        }
      }
    ]
  }'
```

### Example 4: With MongoDB Queries

MongoDB queries use JSON commands instead of SQL. The `command` field should be a JSON string containing the operation details:

```bash
curl -X POST http://localhost:4000/test-with-mongodb \
  -H "Content-Type: application/json" \
  -d '{
    "queries": [
      {
        "databaseType": "mongodb",
        "connectionString": "mongodb://user:pass@localhost:27017/mydb",
        "command": "{\"operation\":\"find\",\"collection\":\"users\",\"filter\":{\"status\":\"active\"}}"
      },
      {
        "databaseType": "mongodb",
        "connectionString": "mongodb://user:pass@localhost:27017/mydb",
        "command": "{\"operation\":\"insertOne\",\"collection\":\"users\",\"document\":{\"name\":\"John\",\"email\":\"john@example.com\"}}"
      }
    ]
  }'
```

**Supported MongoDB Operations:**

- **`find`**: Find multiple documents

  ```json
  {
    "operation": "find",
    "collection": "users",
    "filter": { "status": "active" },
    "options": { "limit": 10, "sort": { "name": 1 } }
  }
  ```

- **`findOne`**: Find a single document

  ```json
  {
    "operation": "findOne",
    "collection": "users",
    "filter": { "id": 1 }
  }
  ```

- **`insertOne`**: Insert a single document

  ```json
  {
    "operation": "insertOne",
    "collection": "users",
    "document": { "name": "John", "email": "john@example.com" }
  }
  ```

- **`insertMany`**: Insert multiple documents

  ```json
  {
    "operation": "insertMany",
    "collection": "users",
    "document": [{ "name": "John" }, { "name": "Jane" }]
  }
  ```

- **`updateOne`**: Update a single document

  ```json
  {
    "operation": "updateOne",
    "collection": "users",
    "filter": { "id": 1 },
    "update": { "$set": { "name": "John Updated" } }
  }
  ```

- **`updateMany`**: Update multiple documents

  ```json
  {
    "operation": "updateMany",
    "collection": "users",
    "filter": { "status": "inactive" },
    "update": { "$set": { "status": "active" } }
  }
  ```

- **`deleteOne`**: Delete a single document

  ```json
  {
    "operation": "deleteOne",
    "collection": "users",
    "filter": { "id": 1 }
  }
  ```

- **`deleteMany`**: Delete multiple documents

  ```json
  {
    "operation": "deleteMany",
    "collection": "users",
    "filter": { "status": "inactive" }
  }
  ```

- **`aggregate`**: Run aggregation pipeline

  ```json
  {
    "operation": "aggregate",
    "collection": "users",
    "pipeline": [
      { "$match": { "status": "active" } },
      { "$group": { "_id": null, "total": { "$sum": 1 } } }
    ]
  }
  ```

- **`count`**: Count documents
  ```json
  {
    "operation": "count",
    "collection": "users",
    "filter": { "status": "active" }
  }
  ```

**Note:** The `database` field is optional in the operation JSON. If not provided, it will be extracted from the connection string or default to `"test"`.

### Example 5: Error Handling

If a request fails, the error information is captured:

```json
{
  "results": [
    {
      "code": "ECONNREFUSED",
      "message": "connect ECONNREFUSED 127.0.0.1:9999",
      "status": undefined,
      "statusText": undefined
    }
  ]
}
```

## Project Structure

```
tools/traffic-tester/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # NestJS module configuration
│   ├── app.controller.ts          # Main controller handling test actions
│   ├── app.types.ts               # TypeScript type definitions
│   ├── dbClients/                 # Database client implementations
│   │   ├── mysql.client.ts        # MySQL query executor
│   │   ├── postgres.client.ts     # PostgreSQL query executor
│   │   └── mongodb.client.ts       # MongoDB operation executor
│   └── types/                     # Type definitions
│       └── IDatabaseQueryResult.ts
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
└── README.md
```

## Installation & Running

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Docker (optional, for containerized deployment)

### Setup

```bash
cd tools/traffic-tester
npm install  # or yarn install
```

### Development

```bash
npm run start:dev  # Starts with hot-reload
```

### Production

```bash
npm run build
npm run start:prod
```

### Docker

#### Building the Docker Image

```bash
cd tools/traffic-tester
./build.sh
# or
docker build -t dokkimi/traffic-tester:latest .
```

#### Running with Docker

```bash
docker run -p 4000:4000 dokkimi/traffic-tester:latest
```

#### With Custom Configuration

```bash
docker run -p 4000:4000 \
  -e NODE_ENV=production \
  dokkimi/traffic-tester:latest
```

## Dependencies

### Runtime Dependencies

- `@nestjs/common` / `@nestjs/core` - NestJS framework
- `@nestjs/platform-express` - Express adapter
- `axios` - HTTP client for making requests
- `mongodb` - MongoDB database client
- `mysql2` - MySQL database client
- `pg` - PostgreSQL database client
- `rxjs` - Reactive extensions

### Development Dependencies

- `@nestjs/cli` - NestJS CLI tools
- `typescript` - TypeScript compiler
- `jest` - Testing framework
- `prettier` - Code formatting

## Use Cases

1. **Integration Testing**: Execute test suites that span multiple services
2. **Service Orchestration**: Coordinate actions across distributed systems
3. **Workflow Testing**: Test multi-step processes that involve multiple services
4. **Database Validation**: Verify database state during integration tests
5. **End-to-End Testing**: Test complete user journeys across services
6. **Load Testing**: Generate traffic patterns across multiple services

## Security Considerations

⚠️ **Important Security Notes:**

1. **No Authentication**: The service currently has no authentication. Consider adding authentication/authorization for production use.

2. **Arbitrary Query Execution**: The service executes arbitrary SQL queries. This is a security risk if exposed to untrusted users.

3. **Arbitrary HTTP Requests**: The service can make HTTP requests to any endpoint. Be cautious about:
   - SSRF (Server-Side Request Forgery) attacks
   - Internal network access
   - Rate limiting

4. **Recommendations**:
   - Add authentication/authorization
   - Validate and sanitize database queries
   - Implement query whitelisting or validation
   - Add rate limiting
   - Restrict network access if possible
   - Use in isolated test environments only

## Limitations

1. **No Connection Pooling**: Database connections are created and closed for each query. For high-volume scenarios, consider implementing connection pooling.

2. **No Request Timeouts**: Requests don't have explicit timeouts. Consider adding timeout configuration.

3. **Basic Error Handling**: Error handling is basic. Consider adding more sophisticated error handling and retry logic.

4. **No Result Caching**: Results are not cached. Each request is executed fresh.

5. **No Request Queuing**: All requests are executed in parallel. Consider adding concurrency limits for high-load scenarios.

## Future Enhancements

- [ ] Add authentication/authorization
- [ ] Implement connection pooling for databases
- [ ] Add request timeout configuration
- [ ] Implement retry logic for failed requests
- [ ] Add structured logging (Winston/Pino)
- [ ] Add metrics (Prometheus)
- [ ] Add request validation
- [ ] Implement rate limiting
- [ ] Add test result storage
- [ ] Add test reporting
- [ ] Support for more database types
- [ ] Add request queuing and concurrency limits

## Related Services

- **control-tower**: May call this service to execute test suites
- **interceptor**: May be used to proxy requests in test scenarios
- **log-processor-service**: May process logs generated during test execution

## Troubleshooting

### Service won't start

- Check if port 4000 is already in use
- Verify all dependencies are installed
- Check TypeScript compilation errors

### Database queries fail

- Verify connection strings are correct
- Check database accessibility
- Verify SQL syntax

### HTTP requests fail

- Check network connectivity
- Verify target service URLs are correct
- Check if target services are running
- Review error messages in response

### Recursive requests not working

- Verify target services are Traffic Tester instances or compatible
- Check that nested `Action` objects are properly formatted
- Review logs for execution flow
