package com.navilite.dto;

import lombok.Data;

@Data
public class ExecuteSqlRequest {
    private String connectionId;
    private String database;
    private String sql;
    private Integer page;
    private Integer pageSize;
}
