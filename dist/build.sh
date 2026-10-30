#!/bin/bash
# 打包：故意排除 server/ecosystem.config.js
# —— 里面含服务器端生成的 COOKIE_SECRET，打进包会在解压时覆盖线上密钥，导致所有登录态失效
V=${1:-dev}
cd "$(dirname "$0")/.."
rm -f "dist/sapere-$V.tar.gz"
tar -czf "dist/sapere-$V.tar.gz" \
  index.html assets \
  server/src server/test server/ecosystem.config.example.js \
  server/deploy-remote.sh server/backup.sh server/README.md server/.env.example
echo "已生成 dist/sapere-$V.tar.gz"
