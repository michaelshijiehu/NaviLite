package com.navilite.service;

import com.navilite.model.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.sql.*;
import java.util.*;

@Slf4j
@Service
public class PostgreSQLDatabaseService implements DatabaseService {

    private Connection getConnection(ConnectionInfo info, String database) throws SQLException {
        String user = (info.getUsername() != null && !info.getUsername().isEmpty()) ? info.getUsername() : System.getProperty("user.name");
        String db = database != null && !database.isEmpty() ? database :
                (info.getDatabase() != null && !info.getDatabase().isEmpty() ? info.getDatabase() : "postgres");
        
        String url = String.format("jdbc:postgresql://%s:%d/%s", info.getHost(), info.getPort(), db);
        Properties props = new Properties();
        props.setProperty("user", user);
        if (info.getPassword() != null && !info.getPassword().isEmpty()) {
            props.setProperty("password", info.getPassword());
        }
        
        try {
            return DriverManager.getConnection(url, props);
        } catch (SQLException e) {
            // If connection to 'postgres' database fails and no database was specified, try connecting to a database with the same name as the user
            if ("postgres".equals(db) && (info.getDatabase() == null || info.getDatabase().isEmpty())) {
                String fallbackUrl = String.format("jdbc:postgresql://%s:%d/%s", info.getHost(), info.getPort(), user);
                log.info("Failed to connect to 'postgres' database, trying fallback to '{}'", user);
                return DriverManager.getConnection(fallbackUrl, props);
            }
            throw e;
        }
    }

    @Override
    public boolean testConnection(ConnectionInfo info) {
        try (Connection conn = getConnection(info, info.getDatabase())) {
            return conn.isValid(5);
        } catch (SQLException e) {
            log.error("PostgreSQL connection test failed: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public List<String> getDatabases(ConnectionInfo info) {
        List<String> databases = new ArrayList<>();
        try (Connection conn = getConnection(info, null);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT datname FROM pg_database WHERE datistemplate = false")) {
            while (rs.next()) {
                databases.add(rs.getString("datname"));
            }
        } catch (SQLException e) {
            log.error("Failed to get databases", e);
        }
        return databases;
    }

    @Override
    public List<TableInfo> getTables(ConnectionInfo info, String database) {
        List<TableInfo> tables = new ArrayList<>();
        try (Connection conn = getConnection(info, database)) {
            DatabaseMetaData metaData = conn.getMetaData();
            try (ResultSet rs = metaData.getTables(database, "public", "%", new String[]{"TABLE", "VIEW"})) {
                while (rs.next()) {
                    TableInfo table = TableInfo.builder()
                            .name(rs.getString("TABLE_NAME"))
                            .type(rs.getString("TABLE_TYPE"))
                            .build();
                    tables.add(table);
                }
            }
        } catch (SQLException e) {
            log.error("Failed to get tables", e);
        }
        return tables;
    }

    @Override
    public TableInfo getTableInfo(ConnectionInfo info, String database, String tableName) {
        TableInfo tableInfo = TableInfo.builder().name(tableName).columns(new ArrayList<>()).build();
        try (Connection conn = getConnection(info, database)) {
            DatabaseMetaData metaData = conn.getMetaData();

            try (ResultSet rs = metaData.getColumns(database, "public", tableName, "%")) {
                while (rs.next()) {
                    ColumnInfo column = ColumnInfo.builder()
                            .name(rs.getString("COLUMN_NAME"))
                            .type(rs.getString("TYPE_NAME"))
                            .length(rs.getInt("COLUMN_SIZE"))
                            .nullable("YES".equals(rs.getString("IS_NULLABLE")))
                            .defaultValue(rs.getString("COLUMN_DEF"))
                            .comment(rs.getString("REMARKS"))
                            .build();
                    tableInfo.getColumns().add(column);
                }
            }

            try (ResultSet rs = metaData.getPrimaryKeys(database, "public", tableName)) {
                Set<String> pkColumns = new HashSet<>();
                while (rs.next()) {
                    pkColumns.add(rs.getString("COLUMN_NAME"));
                }
                for (ColumnInfo col : tableInfo.getColumns()) {
                    col.setPrimaryKey(pkColumns.contains(col.getName()));
                }
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

        try (Connection conn = getConnection(info, database);
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

        try (Connection conn = getConnection(info, database);
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
        // Simplified create table for PostgreSQL
        StringBuilder sql = new StringBuilder("CREATE TABLE \"" + tableInfo.getName() + "\" (");
        List<String> columnDefs = new ArrayList<>();
        List<String> pks = new ArrayList<>();

        for (ColumnInfo col : tableInfo.getColumns()) {
            StringBuilder colDef = new StringBuilder("\"" + col.getName() + "\" " + col.getType());
            if (col.getLength() != null && col.getLength() > 0) {
                colDef.append("(").append(col.getLength()).append(")");
            }
            if (!col.getNullable()) {
                colDef.append(" NOT NULL");
            }
            if (col.getPrimaryKey()) {
                pks.add(col.getName());
            }
            columnDefs.add(colDef.toString());
        }

        sql.append(String.join(", ", columnDefs));
        if (!pks.isEmpty()) {
            sql.append(", PRIMARY KEY (\"").append(String.join("\", \"", pks)).append("\")");
        }
        sql.append(")");

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
        executeUpdate(info, database, "ALTER TABLE \"" + tableName + "\" ALTER COLUMN \"" + column.getName() + "\" TYPE " + column.getType());
    }

    @Override
    public void dropColumn(ConnectionInfo info, String database, String tableName, String columnName) {
        executeUpdate(info, database, "ALTER TABLE \"" + tableName + "\" DROP COLUMN \"" + columnName + "\"");
    }
}
