package com.navilite.service;

import com.navilite.model.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.JedisPoolConfig;
import redis.clients.jedis.params.ScanParams;
import redis.clients.jedis.resps.ScanResult;

import java.util.*;

@Slf4j
@Service
public class RedisDatabaseService implements DatabaseService {

    private JedisPool getPool(ConnectionInfo info) {
        JedisPoolConfig config = new JedisPoolConfig();
        config.setMaxTotal(10);
        config.setMaxIdle(5);

        if (info.getPassword() != null && !info.getPassword().isEmpty()) {
            return new JedisPool(config, info.getHost(), info.getPort(), 3000, info.getPassword());
        } else {
            return new JedisPool(config, info.getHost(), info.getPort(), 3000);
        }
    }

    @Override
    public boolean testConnection(ConnectionInfo info) {
        try (JedisPool pool = getPool(info); Jedis jedis = pool.getResource()) {
            jedis.ping();
            return true;
        } catch (Exception e) {
            log.error("Redis connection test failed", e);
            return false;
        }
    }

    @Override
    public List<String> getDatabases(ConnectionInfo info) {
        List<String> dbs = new ArrayList<>();
        for (int i = 0; i < 16; i++) {
            dbs.add("db" + i);
        }
        return dbs;
    }

    @Override
    public List<TableInfo> getTables(ConnectionInfo info, String database) {
        List<TableInfo> keys = new ArrayList<>();
        try (JedisPool pool = getPool(info); Jedis jedis = pool.getResource()) {
            int dbIndex = database != null ? Integer.parseInt(database.replace("db", "")) : 0;
            jedis.select(dbIndex);

            String cursor = "0";
            ScanParams params = new ScanParams().count(100);
            do {
                ScanResult<String> scanResult = jedis.scan(cursor, params);
                for (String key : scanResult.getResult()) {
                    String type = jedis.type(key);
                    TableInfo table = TableInfo.builder()
                            .name(key)
                            .type(type.toUpperCase())
                            .build();
                    keys.add(table);
                }
                cursor = scanResult.getCursor();
            } while (!cursor.equals("0"));
        } catch (Exception e) {
            log.error("Failed to get keys", e);
        }
        return keys;
    }

    @Override
    public TableInfo getTableInfo(ConnectionInfo info, String database, String tableName) {
        TableInfo tableInfo = TableInfo.builder().name(tableName).columns(new ArrayList<>()).build();
        try (JedisPool pool = getPool(info); Jedis jedis = pool.getResource()) {
            int dbIndex = database != null ? Integer.parseInt(database.replace("db", "")) : 0;
            jedis.select(dbIndex);
            tableInfo.setType(jedis.type(tableName).toUpperCase());

            Long ttl = jedis.ttl(tableName);
            ColumnInfo ttlCol = ColumnInfo.builder().name("TTL").type("Long").build();
            tableInfo.getColumns().add(ttlCol);
        } catch (Exception e) {
            log.error("Failed to get key info", e);
        }
        return tableInfo;
    }

    @Override
    public QueryResult executeQuery(ConnectionInfo info, String database, String sql, Integer page, Integer pageSize) {
        long startTime = System.currentTimeMillis();
        QueryResult.QueryResultBuilder builder = QueryResult.builder();

        try (JedisPool pool = getPool(info); Jedis jedis = pool.getResource()) {
            int dbIndex = database != null ? Integer.parseInt(database.replace("db", "")) : 0;
            jedis.select(dbIndex);

            String key = sql;
            String type = jedis.type(key);
            List<String> columns = new ArrayList<>();
            List<Map<String, Object>> rows = new ArrayList<>();

            columns.add("key");
            columns.add("type");
            columns.add("value");

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("key", key);
            row.put("type", type);

            Object value;
            switch (type) {
                case "string":
                    value = jedis.get(key);
                    break;
                case "hash":
                    value = jedis.hgetAll(key);
                    break;
                case "list":
                    value = jedis.lrange(key, 0, -1);
                    break;
                case "set":
                    value = jedis.smembers(key);
                    break;
                case "zset":
                    value = jedis.zrangeWithScores(key, 0, -1);
                    break;
                default:
                    value = "Unsupported type";
            }
            row.put("value", value);
            rows.add(row);

            builder.success(true)
                    .columns(columns)
                    .rows(rows)
                    .message("Query executed successfully");

        } catch (Exception e) {
            log.error("Query execution failed", e);
            builder.success(false).message(e.getMessage());
        }

        return builder.executionTime(System.currentTimeMillis() - startTime).build();
    }

    @Override
    public QueryResult executeUpdate(ConnectionInfo info, String database, String sql) {
        long startTime = System.currentTimeMillis();
        QueryResult.QueryResultBuilder builder = QueryResult.builder();

        try (JedisPool pool = getPool(info); Jedis jedis = pool.getResource()) {
            int dbIndex = database != null ? Integer.parseInt(database.replace("db", "")) : 0;
            jedis.select(dbIndex);

            // Simple implementation: sql is "key:value" for string types
            if (sql.contains(":")) {
                String[] parts = sql.split(":", 2);
                jedis.set(parts[0], parts[1]);
                builder.success(true).message("Key " + parts[0] + " set successfully");
            } else {
                builder.success(false).message("Invalid command format. Use 'key:value'");
            }
        } catch (Exception e) {
            log.error("Redis update failed", e);
            builder.success(false).message(e.getMessage());
        }

        return builder.executionTime(System.currentTimeMillis() - startTime).build();
    }

    @Override
    public void createTable(ConnectionInfo info, String database, TableInfo tableInfo) {
        // Redis doesn't have tables, use set/add operations
        throw new UnsupportedOperationException("Redis keys are created on write");
    }

    @Override
    public void dropTable(ConnectionInfo info, String database, String tableName) {
        try (JedisPool pool = getPool(info); Jedis jedis = pool.getResource()) {
            int dbIndex = database != null ? Integer.parseInt(database.replace("db", "")) : 0;
            jedis.select(dbIndex);
            jedis.del(tableName);
        } catch (Exception e) {
            log.error("Failed to delete key", e);
            throw new RuntimeException(e);
        }
    }

    @Override
    public void addColumn(ConnectionInfo info, String database, String tableName, ColumnInfo column) {
        throw new UnsupportedOperationException("Redis doesn't have columns");
    }

    @Override
    public void modifyColumn(ConnectionInfo info, String database, String tableName, ColumnInfo column) {
        throw new UnsupportedOperationException("Redis doesn't have columns");
    }

    @Override
    public void dropColumn(ConnectionInfo info, String database, String tableName, String columnName) {
        throw new UnsupportedOperationException("Redis doesn't have columns");
    }
}
