export enum DatabaseType {
  MYSQL = 'MYSQL',
  POSTGRESQL = 'POSTGRESQL',
  SQLITE = 'SQLITE',
  MONGODB = 'MONGODB',
  REDIS = 'REDIS'
}

export interface ConnectionInfo {
  id?: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  filePath?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  length?: number;
  nullable?: boolean;
  primaryKey?: boolean;
  defaultValue?: string;
  comment?: string;
}

export interface TableInfo {
  name: string;
  type?: string;
  rows?: number;
  comment?: string;
  columns?: ColumnInfo[];
}

export interface QueryResult {
  success: boolean;
  message: string;
  executionTime?: number;
  affectedRows?: number;
  columns?: string[];
  rows?: Record<string, any>[];
}

export interface ExecuteSqlRequest {
  connectionId: string;
  database?: string;
  sql: string;
  page?: number;
  pageSize?: number;
}
