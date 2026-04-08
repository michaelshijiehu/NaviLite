package com.navilite.service;

import com.navilite.model.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.sql.*;
import java.util.*;

@Slf4j
@Service
public class MySQLDatabaseService implements DatabaseService {

    private Connection getConnection(ConnectionInfo info, String database) throws SQLException {
        String url;
        if (database != null && !database.isEmpty()) {
            url = String.format("jdbc:mysql://%s:%d/%s?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true",
                    info.getHost(), info.getPort(), database);
        } else {
            url = String.format("jdbc:mysql://%s:%d?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true",
                    info.getHost(), info.getPort());
        }
        return DriverManager.getConnection(url, info.getUsername(), info.getPassword());
    }

    @Override
    public boolean testConnection(ConnectionInfo info) {
        try (Connection conn = getConnection(info, info.getDatabase())) {
            return conn.isValid(5);
        } catch (SQLException e) {
            log.error("MySQL connection test failed", e);
            return false;
        }
    }

    @Override
    public List<String> getDatabases(ConnectionInfo info) {
        List<String> databases = new ArrayList<>();
        try (Connection conn = getConnection(info, null);
             ResultSet rs = conn.getMetaData().getCatalogs()) {
            while (rs.next()) {
                String db = rs.getString("TABLE_CAT");
                if (!isSystemDatabase(db)) {
                    databases.add(db);
                }
            }
        } catch (SQLException e) {
            log.error("Failed to get databases", e);
        }
        return databases;
    }

    private boolean isSystemDatabase(String db) {
        return Arrays.asList("information_schema", "mysql", "performance_schema", "sys").contains(db.toLowerCase());
    }

    @Override
    public List<TableInfo> getTables(ConnectionInfo info, String database) {
        List<TableInfo> tables = new ArrayList<>();
        try (Connection conn = getConnection(info, database)) {
            DatabaseMetaData metaData = conn.getMetaData();
            try (ResultSet rs = metaData.getTables(database, null, "%", new String[]{"TABLE", "VIEW"})) {
                while (rs.next()) {
                    TableInfo table = TableInfo.builder()
                            .name(rs.getString("TABLE_NAME"))
                            .type(rs.getString("TABLE_TYPE"))
                            .comment(rs.getString("REMARKS"))
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

            try (ResultSet rs = metaData.getColumns(database, null, tableName, "%")) {
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

            try (ResultSet rs = metaData.getPrimaryKeys(database, null, tableName)) {
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
        StringBuilder sql = new StringBuilder("CREATE TABLE `").append(tableInfo.getName()).append("` (");
        List<String> columnDefs = new ArrayList<>();
        List<String> pks = new ArrayList<>();

        for (ColumnInfo col : tableInfo.getColumns()) {
            StringBuilder colDef = new StringBuilder("`").append(col.getName()).append("` ").append(col.getType());
            if (col.getLength() != null && col.getLength() > 0) {
                colDef.append("(").append(col.getLength()).append(")");
            }
            if (!col.getNullable()) {
                colDef.append(" NOT NULL");
            }
            if (col.getDefaultValue() != null) {
                colDef.append(" DEFAULT '").append(col.getDefaultValue()).append("'");
            }
            if (col.getPrimaryKey()) {
                pks.add(col.getName());
            }
            columnDefs.add(colDef.toString());
        }

        sql.append(String.join(", ", columnDefs));
        if (!pks.isEmpty()) {
            sql.append(", PRIMARY KEY (`").append(String.join("`, `", pks)).append("`)");
        }
        sql.append(")");

        executeUpdate(info, database, sql.toString());
    }

    @Override
    public void dropTable(ConnectionInfo info, String database, String tableName) {
        executeUpdate(info, database, "DROP TABLE `" + tableName + "`");
    }

    @Override
    public void addColumn(ConnectionInfo info, String database, String tableName, ColumnInfo column) {
        StringBuilder sql = new StringBuilder("ALTER TABLE `").append(tableName).append("` ADD COLUMN `")
                .append(column.getName()).append("` ").append(column.getType());
        if (column.getLength() != null && column.getLength() > 0) {
            sql.append("(").append(column.getLength()).append(")");
        }
        if (!column.getNullable()) {
            sql.append(" NOT NULL");
        }
        executeUpdate(info, database, sql.toString());
    }

    @Override
    public void modifyColumn(ConnectionInfo info, String database, String tableName, ColumnInfo column) {
        StringBuilder sql = new StringBuilder("ALTER TABLE `").append(tableName).append("` MODIFY COLUMN `")
                .append(column.getName()).append("` ").append(column.getType());
        if (column.getLength() != null && column.getLength() > 0) {
            sql.append("(").append(column.getLength()).append(")");
        }
        if (!column.getNullable()) {
            sql.append(" NOT NULL");
        }
        executeUpdate(info, database, sql.toString());
    }

    @Override
    public void dropColumn(ConnectionInfo info, String database, String tableName, String columnName) {
        executeUpdate(info, database, "ALTER TABLE `" + tableName + "` DROP COLUMN `" + columnName + "`");
    }
}
