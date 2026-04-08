package com.navilite.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TableInfo {
    private String name;
    private String type;
    private Long rows;
    private String comment;
    private List<ColumnInfo> columns;
}
