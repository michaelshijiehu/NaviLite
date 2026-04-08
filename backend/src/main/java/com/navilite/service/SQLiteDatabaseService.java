package com.navilite.service;

import com.navilite.model.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.sql.*;
import java.util.*;

@Slf4j
@Service
public class SQLiteDatabaseService implements DatabaseService {

    private Connection getConnection(ConnectionInfo info) throws SQLException {
        String url = "jdbc:sqlite:" + info.getFilePath();
        return DriverManager.getConnection(url);
    }

    @Override
    public boolean testConnection(ConnectionInfo info) {
        try (Connection conn = getConnection(info)) {
            return conn.isValid(5);
        } catch (SQLException e) {
            log.error("SQLite connection test failed", e);
            return false;
        }
    }

    @Override
    public List<String> getDatabases(ConnectionInfo info) {
        return Collections.singletonList("main");
    }

    @Override
    public List<TableInfo> getTables(ConnectionInfo info, String database) {
        List<TableInfo> tables = new ArrayList<>();
        try (Connection conn = getConnection(info);
             ResultSet rs = conn.getMetaData().getTables(null, null, "%", new String[]{"TABLE", "VIEW"})) {
            while (rs.next()) {
                TableInfo table = TableInfo.builder()
                        .name(rs.getString("TABLE_NAME"))
                        .type(rs.getString("TABLE_TYPE"))
                        .build();
                tables.add(table);
            }
        } catch (SQLException e) {
            log.error("Failed to get tables", e);
        }
        return tables;
    }

    @Override
    public TableInfo getTableInfo(ConnectionInfo info, String database, String tableName) {
        TableInfo tableInfo = TableInfo.builder().name(tableName).columns(new ArrayList<>()).build();
        try (Connection conn = getConnection(info);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("PRAGMA table_info(" + tableName + ")")) {
            while (rs.next()) {
                ColumnInfo column = ColumnInfo.builder()
                        .name(rs.getString("name"))
                        .type(rs.getString("type"))
                        .nullable(rs.getInt("notnull") == 0)
                        .primaryKey(rs.getInt("pk") == 1)
                        .defaultValue(rs.getString("dflt_value"))
                        .build();
                tableInfo.getColumns().add(column);
            }
        } catch (SQLException e) {
            log.error("Failed to get table info", e);
        }
        return tableInfo;
    }

    @Override
    public QueryResult executeQuery(ConnectionInfo info, String database, String sql, Integer page, Integer pageSize) {
        long startTime = System.currentTimeMillis();
        QueryResult.QueryResultBuilder builder = QueryResult.builder();
        List<String> columns = new ArrayList<>();
        List<Map<String, Object>> rows = new ArrayList<>();

        try (Connection conn = getConnection(info);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            ResultSetMetaData metaData = rs.getMetaData();
            int columnCount = metaData.getColumnCount();

            for (int i = 1; i <= columnCount; i++) {
                columns.add(metaData.getColumnName(i));
            }

            int offset = (page != null && page > 0) ? (page - 1) * (pageSize != null ? pageSize : 100) : 0;
            int limit = pageSize != null ? pageSize : 1000;
            int count = 0;

            while (rs.next()) {
                if (count >= offset + limit) break;
                if (count >= offset) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= columnCount; i++) {
                        row.put(metaData.getColumnName(i), rs.getObject(i));
                    }
                    rows.add(row);
                }
                count++;
            }

            builder.success(true)
                    .columns(columns)
                    .rows(rows)
                    .message("Query executed successfully");

        } catch (SQLException e) {
            log.error("Query execution failed", e);
            builder.success(false).message(e.getMessage());
        }

        return builder.executionTime(System.currentTimeMillis() - startTime).build();
    }

    @Override
    public QueryResult executeUpdate(ConnectionInfo info, String database, String sql) {
        long startTime = System.currentTimeMillis();
        QueryResult.QueryResultBuilder builder = QueryResult.builder();

        try (Connection conn = getConnection(info);
             Statement stmt = conn.createStatement()) {

            int affectedRows = stmt.executeUpdate(sql);
            builder.success(true)
                    .affectedRows(affectedRows)
                    .message("Statement executed successfully");

        } catch (SQLException e) {
            log.error("Update execution failed", e);
            builder.success(false).message(e.getMessage());
        }

        return builder.executionTime(System.currentTimeMillis() - startTime).build();
    }

    @Override
    public void createTable(ConnectionInfo info, String database, TableInfo tableInfo) {
        StringBuilder sql = new StringBuilder("CREATE TABLE \"" + tableInfo.getName() + "\" (");
        List<String> columnDefs = new ArrayList<>();

        for (ColumnInfo col : tableInfo.getColumns()) {
            StringBuilder colDef = new StringBuilder("\"" + col.getName() + "\" " + col.getType());
            if (col.getPrimaryKey()) {
                colDef.append(" PRIMARY KEY");
            }
            if (!col.getNullable()) {
                colDef.append(" NOT NULL");
            }
            columnDefs.add(colDef.toString());
        }

        sql.append(String.join(", ", columnDefs)).append(")");
        executeUpdate(info, database, sql.toString());
    }

    @Override
    public void dropTable(ConnectionInfo info, String database, String tableName) {
        executeUpdate(info, database, "DROP TABLE \"" + tableName + "\"");
    }

    @Override
    public void addColumn(ConnectionInfo info, String database, String tableName, ColumnInfo column) {
        executeUpdate(info, database, "ALTER TABLE \"" + tableName + "\" ADD COLUMN \"" + column.getName() + "\" " + column.getType());
    }

    @Override
    public void modifyColumn(ConnectionInfo info, String database, String tableName, ColumnInfo column) {
        // SQLite doesn't support ALTER COLUMN, need to recreate table
        throw new UnsupportedOperationException("SQLite doesn't support modifying columns directly");
    }

    @Override
    public void dropColumn(ConnectionInfo info, String database, String tableName, String columnName) {
        // SQLite doesn't support DROP COLUMN, need to recreate table
        throw new UnsupportedOperationException("SQLite doesn't support dropping columns directly");
    }
}
