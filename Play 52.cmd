@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js, then open this launcher again.
  pause
  exit /b 1
)
node tools\local-server.cjs --open
if errorlevel 1 pause
