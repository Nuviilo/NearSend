@echo off
setlocal EnableExtensions
title NearSend Windows EXE Builder

set CSC_IDENTITY_AUTO_DISCOVERY=false

echo ============================================
echo   NearSend - Automatic Windows .EXE Builder
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Please install Node.js LTS from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  pause
  exit /b 1
)

echo [1/4] Installing application dependencies...
call npm install --legacy-peer-deps
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [2/4] Building web assets with Vite...
call npm run build
if errorlevel 1 (
  echo [ERROR] Vite build failed.
  pause
  exit /b 1
)

echo.
echo [3/4] Ensuring Electron packaging tools are installed...
if not exist "node_modules\electron\package.json" (
  call npm install --no-save --legacy-peer-deps electron electron-builder
  if errorlevel 1 (
    echo [ERROR] Failed to install Electron / electron-builder.
    pause
    exit /b 1
  )
) else if not exist "node_modules\electron-builder\package.json" (
  call npm install --no-save --legacy-peer-deps electron electron-builder
  if errorlevel 1 (
    echo [ERROR] Failed to install electron-builder.
    pause
    exit /b 1
  )
)

echo.
echo [4/4] Packaging Windows .EXE (Portable + Installer)...
call npx electron-builder --win --x64 --config electron-builder.json
if errorlevel 1 (
  echo [ERROR] Packaging .exe failed.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Build complete! Files created in: release\
echo   - release\NearSend-Portable.exe
echo   - release\NearSend-Setup.exe
echo ============================================
if exist "release" start "" "release"
pause
