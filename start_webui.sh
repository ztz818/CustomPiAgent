#!/bin/bash

# CustomPiAgent WebUI 一键启动脚本（后台常驻 + 内网穿透）

PROJECT_ROOT="/workspace/nas-data/huya_projects/OpenAgents/projects/CustomPiAgent"
WEBUI_DIR="${PROJECT_ROOT}/webui"
FRP_DIR="/workspace/nas-data/huya_projects/OpenAgents/projects/Network/frp_0.64.0_linux_amd64"
LOG_DIR="${PROJECT_ROOT}/logs"

WEBUI_PORT=13000
FRP_REMOTE_PORT=11881

# 创建日志目录
mkdir -p "${LOG_DIR}"

echo "=========================================="
echo "CustomPiAgent WebUI 启动脚本"
echo "=========================================="

# 1. 停止已有进程
echo "[1/4] 停止已有进程..."
pkill -f "next.*${WEBUI_PORT}" 2>/dev/null
pkill -f "frpc.*frpc.toml" 2>/dev/null
sleep 2

# 2. 构建 WebUI
echo "[2/4] 构建 WebUI..."
cd "${WEBUI_DIR}"
npm_config_cache=../npm_cache npm run build > "${LOG_DIR}/webui_build.log" 2>&1
if [ $? -ne 0 ]; then
    echo "    ❌ 构建失败，请查看日志: ${LOG_DIR}/webui_build.log"
    exit 1
fi
echo "    ✅ 构建完成"

# 3. 启动 WebUI
echo "[3/4] 启动 WebUI (端口 ${WEBUI_PORT})..."
nohup sh -c "npm_config_cache=../npm_cache npm run start -- --port ${WEBUI_PORT}" > "${LOG_DIR}/webui_${WEBUI_PORT}.log" 2>&1 &
WEBUI_PID=$!
echo "    WebUI PID: ${WEBUI_PID}"

# 等待 WebUI 启动
echo "    等待 WebUI 启动..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:${WEBUI_PORT} > /dev/null 2>&1; then
        echo "    ✅ WebUI 启动成功"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "    ❌ WebUI 启动超时"
        exit 1
    fi
    sleep 1
done

# 3. 启动内网穿透
echo "[4/5] 启动内网穿透 (远程端口 ${FRP_REMOTE_PORT})..."
cd "${FRP_DIR}"
nohup ./frpc -c frpc.toml > "${LOG_DIR}/frpc.log" 2>&1 &
FRP_PID=$!
echo "    frpc PID: ${FRP_PID}"

# 等待 frpc 连接
sleep 3
if grep -q "start proxy success" "${LOG_DIR}/frpc.log"; then
    echo "    ✅ 内网穿透启动成功"
else
    echo "    ⚠️  内网穿透可能未成功，请检查日志"
fi

# 4. 显示访问信息
echo ""
echo "=========================================="
echo "✅ 启动完成！"
echo "=========================================="
echo ""
echo "📍 本地访问："
echo "   http://127.0.0.1:${WEBUI_PORT}"
echo ""
echo "🌐 外网访问："
echo "   http://frpv2k.itgo.cc:${FRP_REMOTE_PORT}"
echo ""
echo "📋 进程信息："
echo "   WebUI PID: ${WEBUI_PID}"
echo "   frpc PID:  ${FRP_PID}"
echo ""
echo "📝 日志文件："
echo "   WebUI: ${LOG_DIR}/webui_${WEBUI_PORT}.log"
echo "   frpc:  ${LOG_DIR}/frpc.log"
echo ""
echo "🛑 停止服务："
echo "   kill ${WEBUI_PID} ${FRP_PID}"
echo "   或运行: pkill -f 'next.*${WEBUI_PORT}' && pkill frpc"
echo ""
echo "=========================================="
