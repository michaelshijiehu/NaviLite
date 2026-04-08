package com.navilite.service;

import com.navilite.model.*;

import java.util.List;

public interface DatabaseService {
    boolean testConnection(ConnectionInfo info);
    List<String> getDatabases(ConnectionInfo info);
    List<TableInfo> getTables(ConnectionInfo info, String database);
    TableInfo getTableInfo(ConnectionInfo info, String database, String tableName);
    QueryResult executeQuery(ConnectionInfo info, String database, String sql, Integer page, Integer pageSize);
    QueryResult executeUpdate(ConnectionInfo info, String database, String sql);
    void createTable(ConnectionInfo info, String database, TableInfo tableInfo);
    void dropTable(ConnectionInfo info, String database, String tableName);
    void addColumn(ConnectionInfo info, String database, String tableName, ColumnInfo column);
    void modifyColumn(ConnectionInfo info, String database, String tableName, ColumnInfo column);
    void dropColumn(ConnectionInfo info, String database, String tableName, String columnName);
}
