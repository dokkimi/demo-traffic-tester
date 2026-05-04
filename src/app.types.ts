import { Method } from 'axios';

export type ActionQuery = {
  databaseType: string;
  connectionString: string;
  command: string;
};

export type ActionRequest = {
  baseURL: string;
  url: string;
  method: Method;
  headers?: Record<string, string>;
  data: Action;
};

export type ActionResponse = {
  headers?: Record<string, string>;
  status?: number;
  value?: unknown;
};

export type Action = {
  preRequestLogs?: string[];
  requests?: ActionRequest[];
  queries?: ActionQuery[];
  postRequestLogs?: string[];
  response?: ActionResponse;
};
