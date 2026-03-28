@echo off
setlocal EnableDelayedExpansion
title [PRODUCTNAME] Setup

echo.
echo  =================================================
echo   [PRODUCTNAME] - One-Click Setup
echo  =================================================
echo.

:: ── 1. Check Docker ──────────────────────────────────
echo [1/5] Checking Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Docker is not running.
    echo.
    echo  Please:
    echo    1. Install Docker Desktop: https://www.docker.com/products/docker-desktop/
    echo    2. Start Docker Desktop and wait until the icon in the taskbar stops animating
    echo    3. Run this script again
    echo.
    pause
    exit /b 1
)
echo  Docker is running.

:: ── 2. Copy .env if missing ──────────────────────────
echo.
echo [2/5] Checking environment...
if not exist .env (
    copy .env.example .env >nul
    echo  Created .env from .env.example
) else (
    echo  .env already exists
)

:: ── 3. Start services ────────────────────────────────
echo.
echo [3/5] Starting services (this may take 5-10 min on first run)...
docker compose up -d --build
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: docker compose failed. See output above.
    pause
    exit /b 1
)

:: ── 4. Wait for health checks ────────────────────────
echo.
echo [4/5] Waiting for services to become healthy...
set /a attempts=0
:wait_loop
set /a attempts+=1
if %attempts% gtr 60 (
    echo  Timeout waiting for services. Check: docker compose ps
    pause
    exit /b 1
)

curl -s -o nul -w "%%{http_code}" http://localhost:3001/health 2>nul | findstr "200" >nul
if %errorlevel% equ 0 (
    echo  All services healthy after %attempts% seconds!
    goto :services_ready
)

<nul set /p=.
timeout /t 1 /nobreak >nul
goto :wait_loop

:services_ready
echo.

:: ── 5. Run demo ──────────────────────────────────────
echo [5/5] Running demo to generate sample traces...
python demo\run.py
if %errorlevel% neq 0 (
    echo  (Demo failed - Python may not be installed, but services are running)
)

:: ── Done ─────────────────────────────────────────────
echo.
echo  =================================================
echo   Setup complete!
echo  =================================================
echo.
echo   Dashboard:  http://localhost:3000
echo   Backend:    http://localhost:3001
echo   Proxy:      http://localhost:8080
echo.
echo   Press any key to open the dashboard in your browser...
pause >nul
start http://localhost:3000
