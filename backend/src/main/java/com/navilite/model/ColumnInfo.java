package com.navilite.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ColumnInfo {
    private String name;
    private String type;
    private Integer length;
    private Boolean nullable;
    private Boolean primaryKey;
    private String defaultValue;
    private String comment;
}
