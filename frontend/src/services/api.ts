import axios from 'axios';
import type {
  ConnectionInfo,
  DatabaseType,
  TableInfo,
  QueryResult,
  ExecuteSqlRequest,
  ColumnInfo
} from '../types';

const api = axios.create({
  baseURL: 'http://localhost:8080/api',
  timeout: 30000,
});

export const connectionApi = {
  getAll: () => api.get<ConnectionInfo[]>('/connections'),
  get: (id: string) => api.get<ConnectionInfo>(`/connections/${id}`),
  create: (data: ConnectionInfo) => api.post<ConnectionInfo>('/connections', data),
  update: (id: string, data: ConnectionInfo) => api.put<ConnectionInfo>(`/connections/${id}`, data),
  delete: (id: string) => api.delete(`/connections/${id}`),
  test: (data: {
    type: DatabaseType;
    host: string;
    port: number;
    username: string;
    password: string;
    database?: string;
    filePath?: string;
  }) => api.post<{ success: boolean; message: string }>('/connections/test', data),
  getDatabases: (id: string) => api.get<string[]>(`/connections/${id}/databases`),
};

export const databaseApi = {
  getTables: (connectionId: string, database?: string) =>
    api.get<TableInfo[]>(`/database/${connectionId}/tables`, { params: { database } }),
  getTableInfo: (connectionId: string, tableName: string, database?: string) =>
    api.get<TableInfo>(`/database/${connectionId}/table/${tableName}`, { params: { database } }),
  executeQuery: (connectionId: string, data: ExecuteSqlRequest) =>
    api.post<QueryResult>(`/database/${connectionId}/query`, data),
  executeUpdate: (connectionId: string, data: ExecuteSqlRequest) =>
    api.post<QueryResult>(`/database/${connectionId}/execute`, data),
  createTable: (connectionId: string, tableInfo: TableInfo, database?: string) =>
    api.post(`/database/${connectionId}/table`, tableInfo, { params: { database } }),
  dropTable: (connectionId: string, tableName: string, database?: string) =>
    api.delete(`/database/${connectionId}/table/${tableName}`, { params: { database } }),
  addColumn: (connectionId: string, tableName: string, column: ColumnInfo, database?: string) =>
    api.post(`/database/${connectionId}/table/${tableName}/column`, column, { params: { database } }),
  modifyColumn: (connectionId: string, tableName: string, column: ColumnInfo, database?: string) =>
    api.put(`/database/${connectionId}/table/${tableName}/column`, column, { params: { database } }),
  dropColumn: (connectionId: string, tableName: string, columnName: string, database?: string) =>
    api.delete(`/database/${connectionId}/table/${tableName}/column/${columnName}`, { params: { database } }),
};
