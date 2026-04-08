package com.navilite.model;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import jakarta.persistence.*;

@Getter
@Setter
@ToString
@Entity
@Table(name = "connections")
public class ConnectionInfo {
    @Id
    private String id;
    
    @Column(nullable = false)
    private String name;
    
    // 物理修复：改为 String，让 Hibernate 把它当普通字符串处理，避开 ENUM 校验
    @Column(name = "type", nullable = false, length = 50)
    private String type;
    
    private String host;
    private Integer port;
    private String username;
    private String password;
    
    @Column(name = "database_name")
    private String database;
    
    @Column(name = "file_path")
    private String filePath;

    // 兼容层：让 Controller 依然能获取到枚举类型
    public DatabaseType getType() {
        if (type == null) return null;
        try {
            return DatabaseType.valueOf(type);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    // 兼容层：让 Controller 依然能设置枚举类型
    public void setType(DatabaseType databaseType) {
        this.type = databaseType != null ? databaseType.name() : null;
    }
    
    public void setType(String type) {
        this.type = type;
    }
}
