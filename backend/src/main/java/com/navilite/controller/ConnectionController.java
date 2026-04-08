package com.navilite.controller;

import com.navilite.dto.TestConnectionRequest;
import com.navilite.model.ConnectionInfo;
import com.navilite.model.DatabaseType;
import com.navilite.service.ConnectionStorageService;
import com.navilite.service.DatabaseService;
import com.navilite.service.DatabaseServiceFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/connections")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ConnectionController {

    private final ConnectionStorageService storageService;
    private final DatabaseServiceFactory serviceFactory;

    @GetMapping
    public ResponseEntity<List<ConnectionInfo>> getAllConnections() {
        return ResponseEntity.ok(storageService.getAllConnections());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ConnectionInfo> getConnection(@PathVariable String id) {
        ConnectionInfo conn = storageService.getConnection(id);
        if (conn == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(conn);
    }

    @PostMapping
    public ResponseEntity<ConnectionInfo> createConnection(@RequestBody ConnectionInfo info) {
        return ResponseEntity.ok(storageService.saveConnection(info));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ConnectionInfo> updateConnection(@PathVariable String id, @RequestBody ConnectionInfo info) {
        info.setId(id);
        return ResponseEntity.ok(storageService.saveConnection(info));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConnection(@PathVariable String id) {
        storageService.deleteConnection(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/test")
    public ResponseEntity<Map<String, Object>> testConnection(@RequestBody TestConnectionRequest request) {
        try {
            if (request.getType() == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Database type is required"));
            }
            DatabaseService service = serviceFactory.getService(request.getType());
            if (service == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Unsupported database type: " + request.getType()));
            }

            ConnectionInfo info = new ConnectionInfo();
            info.setType(request.getType());
            info.setHost(request.getHost());
            info.setPort(request.getPort());
            info.setUsername(request.getUsername());
            info.setPassword(request.getPassword());
            info.setDatabase(request.getDatabase());
            info.setFilePath(request.getFilePath());

            boolean success = service.testConnection(info);
            return ResponseEntity.ok(Map.of("success", success, "message", success ? "Connection successful" : "Connection failed"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", "Server error during connection test: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/databases")
    public ResponseEntity<List<String>> getDatabases(@PathVariable String id) {
        ConnectionInfo info = storageService.getConnection(id);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        DatabaseService service = serviceFactory.getService(info.getType());
        return ResponseEntity.ok(service.getDatabases(info));
    }
}
