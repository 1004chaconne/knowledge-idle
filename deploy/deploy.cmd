@echo off
rem Knowledge Idle deploy launcher (Windows)
rem Usage: deploy.cmd v0.29   |   deploy.cmd v0.29 --no-test
setlocal
cd /d "%~dp0.."
where bash >nul 2>nul
if errorlevel 1 (
  echo [X] bash not found. Please install Git for Windows first.
  exit /b 1
)
if "%~1"=="" (
  echo Usage: deploy.cmd v0.29
  exit /b 1
)
bash deploy/deploy.sh %*
