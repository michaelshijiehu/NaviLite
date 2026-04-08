# NaviLite 快速启动指南

## 方式一：IntelliJ IDEA（最推荐，零配置）

1. 打开 IntelliJ IDEA
2. 选择 `File` → `Open`
3. 选择 `/Users/mike/AiProjects/NaviLite/backend` 目录
4. 等待 IDEA 自动下载依赖（右下角有进度条）
5. 找到 `src/main/java/com/navilite/NaviLiteApplication.java`
6. 右键文件，选择 `Run 'NaviLiteApplication'`
7. 后端启动成功！

## 方式二：安装 Maven 后命令行启动

### 安装 Maven

1. 访问 https://maven.apache.org/download.cgi
2. 下载 `apache-maven-3.9.6-bin.tar.gz`
3. 解压到某个目录，比如 `~/Applications/apache-maven-3.9.6`
4. 配置环境变量：
   ```bash
   echo 'export M2_HOME=~/Applications/apache-maven-3.9.6' >> ~/.zshrc
   echo 'export PATH=$M2_HOME/bin:$PATH' >> ~/.zshrc
   source ~/.zshrc
   ```
5. 验证：`mvn -version`

### 启动后端

```bash
cd /Users/mike/AiProjects/NaviLite/backend
mvn spring-boot:run
```

## 前端已经在运行！

前端地址：http://localhost:5173/

## 验证

1. 先启动后端（用 IDEA 方式最简单）
2. 打开浏览器访问 http://localhost:5173/
3. 点击 "New Connection" 添加你的数据库连接
4. 开始使用！
