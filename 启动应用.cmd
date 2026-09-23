@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Please install Node.js, then run this file again.
  pause
  exit /b 1
)
echo Open http://localhost:4173 in your browser.
echo Keep this window open while using the local preview.
node server.mjs
pause
