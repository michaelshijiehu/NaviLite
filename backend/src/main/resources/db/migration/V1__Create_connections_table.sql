CREATE TABLE IF NOT EXISTS connections (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    host VARCHAR(255),
    port INT,
    username VARCHAR(255),
    password VARCHAR(255),
    database_name VARCHAR(255),
    file_path VARCHAR(500)
);
