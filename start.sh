#!/bin/bash

# NaviLite 启动脚本

NAVILITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "======================================"
echo "  NaviLite 启动指南"
echo "======================================"
echo ""
echo "项目目录: $NAVILITE_DIR"
echo ""
echo "启动步骤:"
echo ""
echo "1. 后端启动:"
echo "   cd $NAVILITE_DIR/backend"
echo "   # 如果没有 maven，先安装:"
echo "   # 方式1: 下载 Maven (https://maven.apache.org/download.cgi)"
echo "   # 方式2: 使用 IntelliJ IDEA 打开 backend 目录直接运行"
echo ""
echo "2. 前端启动 (已可用):"
echo "   cd $NAVILITE_DIR/frontend"
echo "   npm run dev"
echo ""
echo "======================================"
echo ""

# 启动前端
echo "正在启动前端..."
cd "$NAVILITE_DIR/frontend"
npm run dev
