import { ActionQuery } from '../app.types';
import { IDatabaseQueryResult } from '../types/IDatabaseQueryResult';
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisClient {
  public async queryDB(
    databaseQuery: ActionQuery,
  ): Promise<IDatabaseQueryResult[]> {
    const { connectionString, command } = databaseQuery;
    const client = new Redis(connectionString);

    try {
      // Parse the command string into tokens, respecting double-quoted strings
      const args = this.parseCommand(command);
      if (args.length === 0) {
        throw new Error('Empty Redis command');
      }

      const result = await client.call(args[0], ...args.slice(1));
      await client.quit();
      return [{ query: command, result }];
    } catch (err) {
      await client.quit();
      const errorMessage = err instanceof Error ? err.message : String(err);
      return [{ query: command, result: errorMessage }];
    }
  }

  private parseCommand(cmd: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < cmd.length; i++) {
      const ch = cmd[i];
      if (ch === '"' && !inQuote) {
        inQuote = true;
      } else if (ch === '"' && inQuote) {
        inQuote = false;
      } else if (ch === ' ' && !inQuote) {
        if (current.length > 0) {
          args.push(current);
          current = '';
        }
      } else {
        current += ch;
      }
    }
    if (current.length > 0) {
      args.push(current);
    }
    return args;
  }
}
