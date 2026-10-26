@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
if not exist "node_modules\next\dist\bin\next" (
  call npm install
  if errorlevel 1 goto failed
)
if not exist ".next\BUILD_ID" (
  node node_modules\next\dist\bin\next build
  if errorlevel 1 goto failed
)
echo Open http://localhost:3000 in your browser. Close this window to stop.
start "" http://localhost:3000
node node_modules\next\dist\bin\next start --hostname 127.0.0.1
if errorlevel 1 goto failed
exit /b 0
:failed
echo Could not start. Install Node.js 22.13 or later and follow README.md.
pause
exit /b 1
