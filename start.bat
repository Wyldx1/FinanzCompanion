@echo off
title Finanz-Companion Starter

echo ========================================
echo   Finanz-Companion wird gestartet...
echo ========================================
echo.

:: Change to script directory
cd /d %~dp0

:: Start PostgreSQL database via Docker
echo [1/3] Starte Datenbank...
docker compose -f docker-compose.dev.yml up -d db
if %errorlevel% neq 0 (
    echo FEHLER: Docker konnte nicht gestartet werden!
    echo Stelle sicher dass Docker Desktop laeuft.
    pause
    exit /b 1
)

:: Wait for database to be ready
echo Warte auf Datenbank...
timeout /t 3 /nobreak >nul

:: Start Web App in new window
echo [2/3] Starte Web-App...
start "Finanz-Companion Web" cmd /k "cd /d %~dp0 && pnpm dev:web"

:: Wait a moment for web to initialize
timeout /t 2 /nobreak >nul

:: Start Bot in new window
echo [3/3] Starte Telegram-Bot...
start "Finanz-Companion Bot" cmd /k "cd /d %~dp0 && pnpm dev:bot"

echo.
echo ========================================
echo   Alles gestartet!
echo ========================================
echo.
echo Web-App:  http://localhost:3000
echo Bot:      Telegram @FinanzCompanionBot
echo.
echo Druecke eine Taste um dieses Fenster zu schliessen...
pause >nul
