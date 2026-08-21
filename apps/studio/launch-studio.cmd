@echo off
setlocal
cd /d "%~dp0\..\.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo BYJTT Studio needs Node.js 26 or newer. Install Node, then open this launcher again.
  pause
  exit /b 1
)

node tools\studio-launcher.mjs %*
if errorlevel 1 (
  echo.
  echo Studio could not start. The error above is safe to copy into ChatGPT for diagnosis.
  pause
  exit /b 1
)
