import { ActionQuery } from '../app.types';
import { IDatabaseQueryResult } from '../types/IDatabaseQueryResult';
import { Injectable } from '@nestjs/common';
import mysql from 'mysql2/promise';

@Injectable()
export class MySQLClient {
  public async queryDB(
    databaseQuery: ActionQuery,
  ): Promise<IDatabaseQueryResult[]> {
    const { connectionString, command } = databaseQuery;
    const queries = command
      .split(';')
      .map((q) => q.trim())
      .filter((q) => !!q);
    const query = queries[queries.length - 1];

    const connection = await mysql.createConnection(connectionString);

    try {
      const result = await connection.execute(query).then((r) => r[0]);
      await connection.end();
      return [{ query, result }];
    } catch (err) {
      await connection.end();
      const errorMessage = err instanceof Error ? err.message : String(err);
      return [{ query, result: errorMessage }];
    }
  }
}
