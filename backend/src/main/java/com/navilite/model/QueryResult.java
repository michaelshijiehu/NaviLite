package com.navilite.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QueryResult {
    private boolean success;
    private String message;
    private Long executionTime;
    private Integer affectedRows;
    private List<String> columns;
    private List<Map<String, Object>> rows;
}
