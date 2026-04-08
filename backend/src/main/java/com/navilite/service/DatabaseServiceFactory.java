package com.navilite.service;

import com.navilite.model.DatabaseType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DatabaseServiceFactory {

    private final MySQLDatabaseService mysqlService;
    private final PostgreSQLDatabaseService postgresqlService;
    private final SQLiteDatabaseService sqliteService;
    private final MongoDBDatabaseService mongodbService;
    private final RedisDatabaseService redisService;

    public DatabaseService getService(DatabaseType type) {
        return switch (type) {
            case MYSQL -> mysqlService;
            case POSTGRESQL -> postgresqlService;
            case SQLITE -> sqliteService;
            case MONGODB -> mongodbService;
            case REDIS -> redisService;
        };
    }
}
