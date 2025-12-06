@echo off
REM ========================================
REM DCS Warehouse Viewer - Windows Startup
REM ========================================

echo.
echo ========================================
echo  DCS Warehouse Viewer - Avvio Server
echo ========================================
echo.

REM Cambia directory al percorso del progetto
cd /d %~dp0

echo [1/3] Verifica Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Node.js non trovato. Installa Node.js da https://nodejs.org/
    pause
    exit /b 1
)

echo [2/3] Build del frontend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Build del frontend fallito
    pause
    exit /b 1
)

echo [3/3] Avvio del server...
echo.
echo ========================================
echo Server in esecuzione su porta 3001
echo Apri il browser: http://localhost:3001
echo.
echo Premi CTRL+C per fermare il server
echo ========================================
echo.

REM Avvia il server
node backend/src/server.js

pause
