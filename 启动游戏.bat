@echo off
chcp 65001 >nul
title 知识即力量
cd /d "%~dp0"

if not exist "index.html" (
  echo.
  echo  找不到 index.html。
  echo  请把这个 bat 放在 index.html 同一个文件夹里再双击。
  echo.
  pause
  exit /b
)

echo.
echo  正在打开游戏...
start "" "%~dp0index.html"
exit
