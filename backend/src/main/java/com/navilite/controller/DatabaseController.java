package com.navilite.controller;

import com.navilite.dto.ExecuteSqlRequest;
import com.navilite.model.*;
import com.navilite.service.ConnectionStorageService;
import com.navilite.service.DatabaseService;
import com.navilite.service.DatabaseServiceFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/database")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DatabaseController {

    private final ConnectionStorageService storageService;
    private final DatabaseServiceFactory serviceFactory;

    @GetMapping("/{connectionId}/tables")
    public ResponseEntity<List<TableInfo>> getTables(
            @PathVariable String connectionId,
            @RequestParam(required = false) String database) {
        ConnectionInfo info = storageService.getConnection(connectionId);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        DatabaseService service = serviceFactory.getService(info.getType());
        return ResponseEntity.ok(service.getTables(info, database));
    }

    @GetMapping("/{connectionId}/table/{tableName}")
    public ResponseEntity<TableInfo> getTableInfo(
            @PathVariable String connectionId,
            @PathVariable String tableName,
            @RequestParam(required = false) String database) {
        ConnectionInfo info = storageService.getConnection(connectionId);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        DatabaseService service = serviceFactory.getService(info.getType());
        return ResponseEntity.ok(service.getTableInfo(info, database, tableName));
    }

    @PostMapping("/{connectionId}/query")
    public ResponseEntity<QueryResult> executeQuery(
            @PathVariable String connectionId,
            @RequestBody ExecuteSqlRequest request) {
        ConnectionInfo info = storageService.getConnection(connectionId);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        DatabaseService service = serviceFactory.getService(info.getType());
        QueryResult result = service.executeQuery(info, request.getDatabase(), request.getSql(), request.getPage(), request.getPageSize());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{connectionId}/execute")
    public ResponseEntity<QueryResult> executeUpdate(
            @PathVariable String connectionId,
            @RequestBody ExecuteSqlRequest request) {
        ConnectionInfo info = storageService.getConnection(connectionId);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        DatabaseService service = serviceFactory.getService(info.getType());
        QueryResult result = service.executeUpdate(info, request.getDatabase(), request.getSql());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{connectionId}/table")
    public ResponseEntity<Void> createTable(
            @PathVariable String connectionId,
            @RequestParam(required = false) String database,
            @RequestBody TableInfo tableInfo) {
        ConnectionInfo info = storageService.getConnection(connectionId);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        DatabaseService service = serviceFactory.getService(info.getType());
        service.createTable(info, database, tableInfo);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{connectionId}/table/{tableName}")
    public ResponseEntity<Void> dropTable(
            @PathVariable String connectionId,
            @PathVariable String tableName,
            @RequestParam(required = false) String database) {
        ConnectionInfo info = storageService.getConnection(connectionId);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        DatabaseService service = serviceFactory.getService(info.getType());
        service.dropTable(info, database, tableName);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{connectionId}/table/{tableName}/column")
    public ResponseEntity<Void> addColumn(
            @PathVariable String connectionId,
            @PathVariable String tableName,
            @RequestParam(required = false) String database,
            @RequestBody ColumnInfo column) {
        ConnectionInfo info = storageService.getConnection(connectionId);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        DatabaseService service = serviceFactory.getService(info.getType());
        service.addColumn(info, database, tableName, column);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{connectionId}/table/{tableName}/column")
    public ResponseEntity<Void> modifyColumn(
            @PathVariable String connectionId,
            @PathVariable String tableName,
            @RequestParam(required = false) String database,
            @RequestBody ColumnInfo column) {
        ConnectionInfo info = storageService.getConnection(connectionId);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        DatabaseService service = serviceFactory.getService(info.getType());
        service.modifyColumn(info, database, tableName, column);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{connectionId}/table/{tableName}/column/{columnName}")
    public ResponseEntity<Void> dropColumn(
            @PathVariable String connectionId,
            @PathVariable String tableName,
            @PathVariable String columnName,
            @RequestParam(required = false) String database) {
        ConnectionInfo info = storageService.getConnection(connectionId);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        DatabaseService service = serviceFactory.getService(info.getType());
        service.dropColumn(info, database, tableName, columnName);
        return ResponseEntity.ok().build();
    }
}
