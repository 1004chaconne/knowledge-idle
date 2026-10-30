@echo off
chcp 65001 >nul
title 知识即力量（本地服务器模式）
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  没有找到 Node.js，改用直接打开的方式。
  echo.
  start "" "%~dp0index.html"
  exit /b
)

echo.
echo  本地服务器模式：http://localhost:8123
echo  适合用手机在同一局域网玩，或需要 http 地址的情况。
echo  关掉这个窗口游戏就停，存档不会丢。
echo.
start "" "http://localhost:8123"
node "tools\serve.js" 8123
