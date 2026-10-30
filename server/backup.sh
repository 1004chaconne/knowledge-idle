#!/bin/bash
# 每日备份存档数据库，保留最近 30 份
# crontab: 20 4 * * * /www/wwwroot/jieke/server/backup.sh
D="$(cd "$(dirname "$0")" && pwd)/data"
mkdir -p "$D/backup"
cp "$D/db.json" "$D/backup/db.$(date +%F).json" 2>/dev/null
find "$D/backup" -name 'db.*.json' -mtime +30 -delete
