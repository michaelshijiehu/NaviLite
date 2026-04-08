package com.navilite.dto;

import com.navilite.model.DatabaseType;
import lombok.Data;

@Data
public class TestConnectionRequest {
    private DatabaseType type;
    private String host;
    private Integer port;
    private String username;
    private String password;
    private String database;
    private String filePath;
}
