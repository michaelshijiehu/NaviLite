# NaviLite

本地数据库管理工具，类似 Navicat。

## 技术栈

- **后端**: Spring Boot 3.2 + Java 17
- **前端**: React 18 + TypeScript + Vite + Ant Design
- **数据库支持**: MySQL, PostgreSQL, SQLite, MongoDB, Redis

## 功能特性

- 数据库连接管理（测试、保存、编辑、删除）
- 支持不指定数据库，显示该实例下所有数据库
- SQL 编辑器和查询执行
- 表数据浏览
- 表结构查看
- 多种数据库类型支持

## 快速开始

### 后端启动

```bash
cd backend
mvn spring-boot:run
```

后端服务运行在 `http://localhost:8080`

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端服务运行在 `http://localhost:5173`

## 项目结构

```
NaviLite/
├── backend/
│   ├── src/main/java/com/navilite/
│   │   ├── controller/    # REST API 控制器
│   │   ├── service/       # 业务逻辑和数据库服务
│   │   ├── model/         # 数据模型
│   │   ├── dto/           # 数据传输对象
│   │   └── config/        # 配置类
│   └── pom.xml
└── frontend/
    ├── src/
    │   ├── components/    # React 组件
    │   ├── services/      # API 服务
    │   ├── types/         # TypeScript 类型
    │   ├── App.tsx        # 主应用组件
    │   └── main.tsx       # 入口文件
    └── package.json
```

## 默认端口配置

| 数据库 | 默认端口 |
|--------|----------|
| MySQL | 3306 |
| PostgreSQL | 5432 |
| MongoDB | 27017 |
| Redis | 6379 |

## 连接配置存储

连接配置保存在 `~/.navilite/connections.json`
