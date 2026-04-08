package com.navilite.service;

import com.mongodb.client.*;
import com.navilite.model.*;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class MongoDBDatabaseService implements DatabaseService {

    private MongoClient getClient(ConnectionInfo info) {
        String uri;
        if (info.getUsername() != null && !info.getUsername().isEmpty()) {
            uri = String.format("mongodb://%s:%s@%s:%d",
                    info.getUsername(), info.getPassword(), info.getHost(), info.getPort());
        } else {
            uri = String.format("mongodb://%s:%d", info.getHost(), info.getPort());
        }
        return MongoClients.create(uri);
    }

    @Override
    public boolean testConnection(ConnectionInfo info) {
        try (MongoClient client = getClient(info)) {
            client.getDatabase("admin").runCommand(new Document("ping", 1));
            return true;
        } catch (Exception e) {
            log.error("MongoDB connection test failed", e);
            return false;
        }
    }

    @Override
    public List<String> getDatabases(ConnectionInfo info) {
        try (MongoClient client = getClient(info)) {
            return client.listDatabaseNames().into(new ArrayList<>());
        } catch (Exception e) {
            log.error("Failed to get databases", e);
            return new ArrayList<>();
        }
    }

    @Override
    public List<TableInfo> getTables(ConnectionInfo info, String database) {
        List<TableInfo> collections = new ArrayList<>();
        try (MongoClient client = getClient(info)) {
            MongoDatabase db = client.getDatabase(database);
            for (String name : db.listCollectionNames()) {
                TableInfo table = TableInfo.builder()
                        .name(name)
                        .type("COLLECTION")
                        .build();
                collections.add(table);
            }
        } catch (Exception e) {
            log.error("Failed to get collections", e);
        }
        return collections;
    }

    @Override
    public TableInfo getTableInfo(ConnectionInfo info, String database, String tableName) {
        TableInfo tableInfo = TableInfo.builder().name(tableName).columns(new ArrayList<>()).build();
        try (MongoClient client = getClient(info)) {
            MongoDatabase db = client.getDatabase(database);
            MongoCollection<Document> collection = db.getCollection(tableName);

            tableInfo.setRows(collection.countDocuments());

            Document sample = collection.find().first();
            if (sample != null) {
                for (String key : sample.keySet()) {
                    Object value = sample.get(key);
                    ColumnInfo column = ColumnInfo.builder()
                            .name(key)
                            .type(value != null ? value.getClass().getSimpleName() : "null")
                            .build();
                    tableInfo.getColumns().add(column);
                }
            }
        } catch (Exception e) {
            log.error("Failed to get collection info", e);
        }
        return tableInfo;
    }

    @Override
    public QueryResult executeQuery(ConnectionInfo info, String database, String sql, Integer page, Integer pageSize) {
        long startTime = System.currentTimeMillis();
        QueryResult.QueryResultBuilder builder = QueryResult.builder();

        try (MongoClient client = getClient(info)) {
            MongoDatabase db = client.getDatabase(database);

            Document queryDoc = Document.parse(sql);
            String collectionName = queryDoc.getString("collection");
            Document filter = queryDoc.get("filter", Document.class);
            if (filter == null) filter = new Document();

            MongoCollection<Document> collection = db.getCollection(collectionName);
            FindIterable<Document> find = collection.find(filter);

            int skip = (page != null && page > 0) ? (page - 1) * (pageSize != null ? pageSize : 100) : 0;
            int limit = pageSize != null ? pageSize : 100;

            List<Map<String, Object>> rows = new ArrayList<>();
            List<String> columns = new ArrayList<>();

            for (Document doc : find.skip(skip).limit(limit)) {
                Map<String, Object> row = new LinkedHashMap<>(doc);
                rows.add(row);
                if (columns.isEmpty()) {
                    columns.addAll(doc.keySet());
                }
            }

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

        try (MongoClient client = getClient(info)) {
            MongoDatabase db = client.getDatabase(database);
            Document commandDoc = Document.parse(sql);
            String command = commandDoc.getString("command");
            String collectionName = commandDoc.getString("collection");
            
            if (command == null) {
                // Default to runCommand if no specific command is provided
                Document result = db.runCommand(commandDoc);
                builder.success(true).message("Command executed successfully");
            } else {
                MongoCollection<Document> collection = db.getCollection(collectionName);
                int affected = 0;
                
                switch (command.toLowerCase()) {
                    case "insert":
                        Document doc = commandDoc.get("document", Document.class);
                        collection.insertOne(doc);
                        affected = 1;
                        break;
                    case "delete":
                        Document filter = commandDoc.get("filter", Document.class);
                        affected = (int) collection.deleteMany(filter).getDeletedCount();
                        break;
                    case "update":
                        Document updateFilter = commandDoc.get("filter", Document.class);
                        Document updateDoc = commandDoc.get("update", Document.class);
                        affected = (int) collection.updateMany(updateFilter, new Document("$set", updateDoc)).getModifiedCount();
                        break;
                    default:
                        Document result = db.runCommand(commandDoc);
                        builder.success(true);
                }
                builder.success(true).affectedRows(affected).message("Action " + command + " completed");
            }
        } catch (Exception e) {
            log.error("MongoDB action failed", e);
            builder.success(false).message(e.getMessage());
        }

        return builder.executionTime(System.currentTimeMillis() - startTime).build();
    }

    @Override
    public void createTable(ConnectionInfo info, String database, TableInfo tableInfo) {
        try (MongoClient client = getClient(info)) {
            MongoDatabase db = client.getDatabase(database);
            db.createCollection(tableInfo.getName());
        } catch (Exception e) {
            log.error("Failed to create collection", e);
            throw new RuntimeException(e);
        }
    }

    @Override
    public void dropTable(ConnectionInfo info, String database, String tableName) {
        try (MongoClient client = getClient(info)) {
            MongoDatabase db = client.getDatabase(database);
            db.getCollection(tableName).drop();
        } catch (Exception e) {
            log.error("Failed to drop collection", e);
            throw new RuntimeException(e);
        }
    }

    @Override
    public void addColumn(ConnectionInfo info, String database, String tableName, ColumnInfo column) {
        throw new UnsupportedOperationException("MongoDB is schema-less");
    }

    @Override
    public void modifyColumn(ConnectionInfo info, String database, String tableName, ColumnInfo column) {
        throw new UnsupportedOperationException("MongoDB is schema-less");
    }

    @Override
    public void dropColumn(ConnectionInfo info, String database, String tableName, String columnName) {
        throw new UnsupportedOperationException("MongoDB is schema-less");
    }
}
