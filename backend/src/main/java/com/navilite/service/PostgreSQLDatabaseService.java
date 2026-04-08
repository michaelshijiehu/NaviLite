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
        // 核心修复：如果用户未填写用户名，显式默认使用 "postgres"，防止驱动程序自动抓取系统用户名 "root"
        String user = (info.getUsername() != null && !info.getUsername().isEmpty()) ? info.getUsername() : "postgres";
        String password = info.getPassword();
        
        String db = (database != null && !database.isEmpty()) ? database :
                (info.getDatabase() != null && !info.getDatabase().isEmpty() ? info.getDatabase() : "postgres");
        
        String url = String.format("jdbc:postgresql://%s:%d/%s", info.getHost(), info.getPort(), db);
        
        log.info("Connecting to PostgreSQL: {} as user: {}", url, user);
        
        // 使用显式的 user/password 调用，不给驱动程序留下回退到系统用户名的余地
        if (password != null && !password.isEmpty()) {
            return DriverManager.getConnection(url, user, password);
        } else {
            // 注意：Postgres 即使没有密码，通常也需要 user 参数
            Properties props = new Properties();
            props.setProperty("user", user);
            return DriverManager.getConnection(url, props);
        }
    }

    @Override
    public boolean testConnection(ConnectionInfo info) {
        try (Connection conn = getConnection(info, info.getDatabase())) {
            return conn.isValid(5);
        } catch (SQLException e) {
            log.error("PostgreSQL test failed: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public List<String> getDatabases(ConnectionInfo info) {
        List<String> databases = new ArrayList<>();
        String initialDb = (info.getDatabase() != null && !info.getDatabase().isEmpty()) ? info.getDatabase() : "postgres";
        try (Connection conn = getConnection(info, initialDb);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")) {
            while (rs.next()) databases.add(rs.getString("datname"));
        } catch (SQLException e) {
            log.warn("Failed to get databases: {}", e.getMessage());
            if (info.getDatabase() != null) databases.add(info.getDatabase());
        }
        return databases;
    }

    @Override
    public List<TableInfo> getTables(ConnectionInfo info, String database) {
        List<TableInfo> tables = new ArrayList<>();
        // 改进 SQL，不仅查找表名，还要排除系统模式
        String sql = "SELECT table_name, table_type " +
                     "FROM information_schema.tables " +
                     "WHERE table_schema NOT IN ('information_schema', 'pg_catalog') " +
                     "AND table_schema NOT LIKE 'pg_temp_%' " +
                     "ORDER BY table_name";
        
        try (Connection conn = getConnection(info, database);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                tables.add(TableInfo.builder()
                        .name(rs.getString("table_name"))
                        .type(rs.getString("table_type").equals("BASE TABLE") ? "TABLE" : "VIEW")
                        .build());
            }
        } catch (SQLException e) {
            log.error("Failed to get tables for DB {}: {}", database, e.getMessage());
        }
        return tables;
    }

    @Override
    public TableInfo getTableInfo(ConnectionInfo info, String database, String tableName) {
        TableInfo tableInfo = TableInfo.builder().name(tableName).columns(new ArrayList<>()).build();
        try (Connection conn = getConnection(info, database)) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            // 查找该表所属的 schema
            String schemaName = null;
            try (ResultSet rs = metaData.getTables(null, null, tableName, null)) {
                if (rs.next()) {
                    schemaName = rs.getString("TABLE_SCHEM");
                }
            }

            try (ResultSet rs = metaData.getColumns(null, schemaName, tableName, "%")) {
                while (rs.next()) {
                    tableInfo.getColumns().add(ColumnInfo.builder()
                            .name(rs.getString("COLUMN_NAME"))
                            .type(rs.getString("TYPE_NAME"))
                            .length(rs.getInt("COLUMN_SIZE"))
                            .nullable("YES".equals(rs.getString("IS_NULLABLE")))
                            .defaultValue(rs.getString("COLUMN_DEF"))
                            .build());
                }
            }

            try (ResultSet rs = metaData.getPrimaryKeys(null, schemaName, tableName)) {
                Set<String> pkCols = new HashSet<>();
                while (rs.next()) pkCols.add(rs.getString("COLUMN_NAME"));
                for (ColumnInfo col : tableInfo.getColumns()) {
                    col.setPrimaryKey(pkCols.contains(col.getName()));
                }
            }
        } catch (SQLException e) { log.error("Failed to get table info", e); }
        return tableInfo;
    }

    @Override
    public QueryResult executeQuery(ConnectionInfo info, String database, String sql, Integer page, Integer pageSize) {
        long startTime = System.currentTimeMillis();
        QueryResult.QueryResultBuilder builder = QueryResult.builder();
        try (Connection conn = getConnection(info, database);
             Statement stmt = conn.createStatement()) {
            boolean hasRs = stmt.execute(sql);
            if (hasRs) {
                try (ResultSet rs = stmt.getResultSet()) {
                    ResultSetMetaData md = rs.getMetaData();
                    int cols = md.getColumnCount();
                    List<String> colNames = new ArrayList<>();
                    for (int i = 1; i <= cols; i++) colNames.add(md.getColumnName(i));
                    
                    List<Map<String, Object>> rows = new ArrayList<>();
                    int offset = (page != null && page > 0) ? (page - 1) * (pageSize != null ? pageSize : 100) : 0;
                    int limit = pageSize != null ? pageSize : 1000;
                    int count = 0;
                    while (rs.next()) {
                        if (count >= offset + limit) break;
                        if (count >= offset) {
                            Map<String, Object> row = new LinkedHashMap<>();
                            for (int i = 1; i <= cols; i++) row.put(md.getColumnName(i), rs.getObject(i));
                            rows.add(row);
                        }
                        count++;
                    }
                    builder.success(true).columns(colNames).rows(rows).message("Query success");
                }
            } else {
                builder.success(true).affectedRows(stmt.getUpdateCount()).message("Update success");
            }
        } catch (SQLException e) {
            log.error("Execution failed: {}", e.getMessage());
            builder.success(false).message(e.getMessage());
        }
        return builder.executionTime(System.currentTimeMillis() - startTime).build();
    }

    @Override public QueryResult executeUpdate(ConnectionInfo info, String database, String sql) { return executeQuery(info, database, sql, null, null); }
    @Override public void createTable(ConnectionInfo info, String database, TableInfo t) {}
    @Override public void dropTable(ConnectionInfo info, String database, String tableName) { executeUpdate(info, database, "DROP TABLE IF EXISTS \"" + tableName + "\""); }
    @Override public void addColumn(ConnectionInfo info, String db, String t, ColumnInfo c) {}
    @Override public void modifyColumn(ConnectionInfo info, String db, String t, ColumnInfo c) {}
    @Override public void dropColumn(ConnectionInfo info, String db, String t, String c) {}
}
