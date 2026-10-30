#!/usr/bin/env bash
# 在服务器上执行：bash deploy-remote.sh sapere-v0.12.tar.gz
# 做四件事：备份旧站点 → 解压新包 → 生成密钥 → 起 pm2 并自检
set -euo pipefail

ROOT="/www/wwwroot/jieke"
PKG="${1:?用法: bash deploy-remote.sh <包路径.tar.gz>}"
APP="sapere-game"
PORT="${PORT:-9400}"

echo "==> 1/5 备份现有站点"
STAMP=$(date +%Y%m%d-%H%M%S)
if [ -d "$ROOT" ] && [ -n "$(ls -A "$ROOT" 2>/dev/null)" ]; then
  tar -czf "/www/wwwroot/jieke-backup-$STAMP.tar.gz" -C /www/wwwroot jieke
  echo "    已备份到 /www/wwwroot/jieke-backup-$STAMP.tar.gz"
else
  mkdir -p "$ROOT"
  echo "    目录为空，跳过备份"
fi

echo "==> 2/5 解压新版本"
tar -xzf "$PKG" -C "$ROOT"
mkdir -p "$ROOT/server/data"

echo "==> 3/5 检查端口 $PORT"
if ss -lntp 2>/dev/null | grep -q ":$PORT "; then
  echo "    !! 端口 $PORT 已被占用，请改 PORT 后重试"; exit 1
fi
echo "    端口 $PORT 空闲"

echo "==> 4/5 生成会话密钥并写入 pm2 配置"
SECRET=$(openssl rand -hex 24)
sed -i "s/CHANGE_ME_BEFORE_DEPLOY/$SECRET/" "$ROOT/server/ecosystem.config.js"
sed -i "s/PORT: 9400/PORT: $PORT/" "$ROOT/server/ecosystem.config.js"
echo "    已写入（长度 ${#SECRET}）"

echo "==> 5/5 启动并自检"
cd "$ROOT/server"
pm2 delete "$APP" >/dev/null 2>&1 || true
pm2 start ecosystem.config.js
pm2 save >/dev/null
sleep 1.5
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" || echo "000")
API=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/api/me" || echo "000")
echo "    首页 HTTP $CODE（期望 200）"
echo "    /api/me HTTP $API（期望 401，表示服务在跑且未登录）"
echo
echo "完成。接下来去宝塔把这个站点改成反向代理 -> http://127.0.0.1:$PORT"
echo "并在反代配置里确认有： proxy_set_header X-Forwarded-Proto \$scheme;"
