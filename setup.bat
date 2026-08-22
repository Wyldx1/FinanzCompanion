@echo off
chcp 65001 >nul
title Finanz-Companion Setup

echo.
echo ============================================
echo    Finanz-Companion - Lokales Setup
echo ============================================
echo.

:: Prüfen ob pnpm installiert ist
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [1/7] pnpm wird installiert...
    call npm install -g pnpm
) else (
    echo [1/7] pnpm ist bereits installiert ✓
)

:: Dependencies installieren
echo.
echo [2/7] Dependencies werden installiert...
call pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: pnpm install fehlgeschlagen!
    pause
    exit /b 1
)
echo Dependencies installiert ✓

:: Docker prüfen
echo.
echo [3/7] Docker wird geprüft...
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: Docker nicht gefunden!
    echo Bitte Docker Desktop installieren und neu starten.
    pause
    exit /b 1
)

:: PostgreSQL Container starten
echo.
echo [4/7] PostgreSQL Container wird gestartet...
docker compose -f docker-compose.dev.yml up -d
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: Docker Container konnte nicht gestartet werden!
    echo Ist Docker Desktop gestartet?
    pause
    exit /b 1
)
echo PostgreSQL läuft ✓

:: Warten bis DB bereit ist
echo.
echo [5/7] Warte auf Datenbank...
timeout /t 5 /nobreak >nul

:: .env Dateien kopieren
echo.
echo [6/7] Umgebungsvariablen werden konfiguriert...
if not exist .env (
    copy /Y .env.example .env >nul
    echo .env erstellt - bitte API Keys eintragen!
)
copy /Y .env apps\web\.env.local >nul
copy /Y .env packages\db\.env >nul
copy /Y .env apps\bot\.env >nul
echo .env Dateien kopiert ✓

:: Datenbank Setup
echo.
echo [7/7] Datenbank wird eingerichtet...
cd packages\db
call pnpm generate
call pnpm migrate
call pnpm seed
cd ..\..

echo.
echo ============================================
echo    Setup abgeschlossen!
echo ============================================
echo.
echo Starte die App mit:
echo    pnpm dev:web
echo.
echo Dann öffne: http://localhost:3000
echo Login-Passwort: changeme
echo.
pause
