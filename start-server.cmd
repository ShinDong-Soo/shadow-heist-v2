@echo off
setlocal

rem Always run from the project folder, even when this file is double-clicked.
cd /d "%~dp0"

where node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install Node.js 22.12 or newer, then try again.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo [ERROR] Project dependencies are not installed.
  echo Open a terminal in this folder and run: npm.cmd install
  pause
  exit /b 1
)

echo Starting Shadow Heist V2...
echo Open the Local address shown below in Chrome or Edge.
call npm.cmd run dev

if errorlevel 1 (
  echo.
  echo [ERROR] The development server stopped with an error.
  pause
  exit /b 1
)

endlocal
