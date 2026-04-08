DELETE FROM connections;
INSERT INTO connections (id, name, type, host, port, username, password, database_name, file_path) 
VALUES 
('conn-mysql-1', 'Docker MySQL', 'MYSQL', 'localhost', 3306, 'root', '', 'navilite', ''),
('conn-postgres-1', 'Docker PostgreSQL', 'POSTGRESQL', 'localhost', 5432, 'root', '', 'postgres', ''),
('conn-sqlite-1', 'Local SQLite', 'SQLITE', 'localhost', 0, '', '', '', '/Users/mike/AiProjects/NaviLite/backend/data/sample.db'),
('conn-mongo-1', 'Docker MongoDB', 'MONGODB', 'localhost', 27017, '', '', 'admin', ''),
('conn-redis-1', 'Docker Redis', 'REDIS', 'localhost', 6379, '', '', '0', '');