@echo off
title Finanz-Companion Stop

cd /d %~dp0

echo.
echo ========================================
echo   Finanz-Companion wird gestoppt...
echo ========================================
echo.

echo Stoppe Docker Container (Datenbank)...
docker compose -f docker-compose.dev.yml down

echo.
echo Hinweis: Web-App und Bot Fenster muessen
echo          manuell geschlossen werden.
echo.
echo Alles gestoppt!
timeout /t 3 >nul
