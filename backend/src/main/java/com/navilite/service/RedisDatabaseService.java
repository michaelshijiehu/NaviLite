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

    @Override public boolean testConnection(ConnectionInfo info) {
        try (JedisPool pool = getPool(info); Jedis jedis = pool.getResource()) { return "PONG".equals(jedis.ping()); }
        catch (Exception e) { return false; }
    }

    @Override public List<String> getDatabases(ConnectionInfo info) {
        List<String> dbs = new ArrayList<>();
        for (int i = 0; i < 16; i++) dbs.add("db" + i);
        return dbs;
    }

    @Override public List<TableInfo> getTables(ConnectionInfo info, String database) {
        List<TableInfo> keys = new ArrayList<>();
        try (JedisPool pool = getPool(info); Jedis jedis = pool.getResource()) {
            int dbIndex = database != null ? Integer.parseInt(database.replace("db", "")) : 0;
            jedis.select(dbIndex);
            String cursor = "0";
            ScanParams params = new ScanParams().count(100);
            do {
                ScanResult<String> scanResult = jedis.scan(cursor, params);
                for (String key : scanResult.getResult()) {
                    keys.add(TableInfo.builder().name(key).type(jedis.type(key).toUpperCase()).build());
                }
                cursor = scanResult.getCursor();
            } while (!cursor.equals("0"));
        } catch (Exception e) { log.error("Redis list keys failed", e); }
        return keys;
    }

    @Override public TableInfo getTableInfo(ConnectionInfo info, String database, String tableName) {
        try (JedisPool pool = getPool(info); Jedis jedis = pool.getResource()) {
            int dbIndex = database != null ? Integer.parseInt(database.replace("db", "")) : 0;
            jedis.select(dbIndex);
            return TableInfo.builder().name(tableName).type(jedis.type(tableName).toUpperCase()).comment("TTL: " + jedis.ttl(tableName)).build();
        } catch (Exception e) { return TableInfo.builder().name(tableName).build(); }
    }

    @Override public QueryResult executeQuery(ConnectionInfo info, String database, String key, Integer page, Integer pageSize) {
        long start = System.currentTimeMillis();
        try (JedisPool pool = getPool(info); Jedis jedis = pool.getResource()) {
            int dbIdx = database != null ? Integer.parseInt(database.replace("db", "")) : 0;
            jedis.select(dbIdx);
            
            if ("__INFO__".equals(key)) {
                String redisInfo = jedis.info();
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("key", "INFO");
                row.put("type", "string");
                row.put("value", redisInfo);
                return QueryResult.builder().success(true).columns(List.of("key", "type", "value")).rows(List.of(row)).executionTime(System.currentTimeMillis() - start).build();
            }

            String type = jedis.type(key);
            Object val;
            switch (type) {
                case "hash": val = jedis.hgetAll(key); break;
                case "list": val = jedis.lrange(key, 0, -1); break;
                case "set": val = jedis.smembers(key); break;
                case "zset": 
                    List<Map<String, Object>> zsetList = new ArrayList<>();
                    for(redis.clients.jedis.resps.Tuple t : jedis.zrangeWithScores(key, 0, -1)) {
                        Map<String, Object> m = new HashMap<>();
                        m.put("value", t.getElement());
                        m.put("score", t.getScore());
                        zsetList.add(m);
                    }
                    val = zsetList;
                    break;
                default: val = jedis.get(key);
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("key", key); 
            row.put("type", type); 
            row.put("value", val); 
            row.put("ttl", jedis.ttl(key));
            
            try {
                // Safely send MEMORY USAGE command
                Object usage = jedis.sendCommand(() -> "MEMORY".getBytes(), "USAGE", key);
                if (usage instanceof Long) {
                    row.put("memory", (Long) usage);
                } else if (usage instanceof byte[]) {
                    row.put("memory", Long.parseLong(new String((byte[]) usage)));
                }
            } catch (Exception ignored) {}

            return QueryResult.builder().success(true).columns(List.of("key", "type", "value", "ttl", "memory")).rows(List.of(row)).executionTime(System.currentTimeMillis() - start).build();
        } catch (Exception e) { return QueryResult.builder().success(false).message(e.getMessage()).build(); }
    }

    @Override public QueryResult executeUpdate(ConnectionInfo info, String database, String command) {
        try (JedisPool pool = getPool(info); Jedis jedis = pool.getResource()) {
            int dbIdx = database != null ? Integer.parseInt(database.replace("db", "")) : 0;
            jedis.select(dbIdx);
            
            if (command.trim().startsWith("{")) {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                Map<String, Object> map = mapper.readValue(command, Map.class);
                String action = String.valueOf(map.get("action")).toLowerCase();
                String key = String.valueOf(map.get("key"));
                
                switch (action) {
                    case "set": jedis.set(key, String.valueOf(map.get("value"))); break;
                    case "hset": jedis.hset(key, String.valueOf(map.get("field")), String.valueOf(map.get("value"))); break;
                    case "lpush": jedis.lpush(key, String.valueOf(map.get("value"))); break;
                    case "rpush": jedis.rpush(key, String.valueOf(map.get("value"))); break;
                    case "sadd": jedis.sadd(key, String.valueOf(map.get("value"))); break;
                    case "zadd": jedis.zadd(key, Double.parseDouble(String.valueOf(map.get("score"))), String.valueOf(map.get("value"))); break;
                    case "del": jedis.del(key); break;
                    case "hdel": jedis.hdel(key, String.valueOf(map.get("field"))); break;
                    case "lrem": jedis.lrem(key, 0, String.valueOf(map.get("value"))); break;
                    case "srem": jedis.srem(key, String.valueOf(map.get("value"))); break;
                    case "zrem": jedis.zrem(key, String.valueOf(map.get("value"))); break;
                    case "rename": jedis.rename(key, String.valueOf(map.get("newKey"))); break;
                }
                
                if (map.containsKey("ttl") && map.get("ttl") != null) {
                    try {
                        long ttl = Long.parseLong(String.valueOf(map.get("ttl")));
                        if (ttl > 0) {
                            jedis.expire(key, ttl);
                        } else if (ttl == -1) {
                            jedis.persist(key);
                        }
                    } catch (Exception ignored) {}
                }
                return QueryResult.builder().success(true).message("Redis action success").build();
            }
            
            String[] parts = command.split("\\|", 4);
            String action = parts[0].toLowerCase();
            
            if ("set".equals(action)) {
                String key = parts[1];
                String value = parts[2];
                jedis.set(key, value);
                
                if (parts.length > 3 && !parts[3].isEmpty()) {
                    try {
                        long ttl = Long.parseLong(parts[3]);
                        if (ttl > 0) jedis.expire(key, ttl);
                    } catch (NumberFormatException e) {
                        log.warn("Invalid TTL format: {}", parts[3]);
                    }
                }
            } else if ("del".equals(action)) {
                jedis.del(parts[1]);
            }
            return QueryResult.builder().success(true).message("Redis action success").build();
        } catch (Exception e) { return QueryResult.builder().success(false).message(e.getMessage()).build(); }
    }

    @Override public void createTable(ConnectionInfo info, String database, TableInfo t) {}
    @Override public void dropTable(ConnectionInfo info, String database, String tableName) { executeUpdate(info, database, "del|" + tableName + "|"); }
    @Override public void addColumn(ConnectionInfo info, String db, String t, ColumnInfo c) {}
    @Override public void modifyColumn(ConnectionInfo info, String db, String t, ColumnInfo c) {}
    @Override public void dropColumn(ConnectionInfo info, String db, String t, String c) {}
}
