package com.navilite.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.navilite.model.ConnectionInfo;
import com.navilite.repository.ConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConnectionStorageService {

    @Value("${connections.config.path:${user.home}/.navilite/connections.json}")
    private String configPath;

    private final ConnectionRepository repository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostConstruct
    public void init() {
        if (repository.count() == 0) {
            migrateFromJson();
        }
    }

    private void migrateFromJson() {
        try {
            File file = new File(configPath);
            if (file.exists()) {
                log.info("Migrating existing connections from JSON to MySQL...");
                List<ConnectionInfo> list = objectMapper.readValue(file, new TypeReference<List<ConnectionInfo>>() {});
                for (ConnectionInfo conn : list) {
                    if (conn.getId() == null) {
                        conn.setId(UUID.randomUUID().toString());
                    }
                    repository.save(conn);
                }
                log.info("Migrated {} connections successfully.", list.size());
            }
        } catch (IOException e) {
            log.warn("Failed to migrate connections from JSON", e);
        }
    }

    public List<ConnectionInfo> getAllConnections() {
        return repository.findAll();
    }

    public ConnectionInfo getConnection(String id) {
        return repository.findById(id).orElse(null);
    }

    public ConnectionInfo saveConnection(ConnectionInfo info) {
        if (info.getId() == null || info.getId().isEmpty()) {
            info.setId(UUID.randomUUID().toString());
        }
        return repository.save(info);
    }

    public void deleteConnection(String id) {
        repository.deleteById(id);
    }
}
