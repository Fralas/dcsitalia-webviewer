@echo off
REM ========================================
REM DCS Warehouse Viewer - PM2 Startup (Windows)
REM ========================================

echo.
echo ========================================
echo  DCS Warehouse Viewer - Avvio con PM2
echo ========================================
echo.

REM Cambia directory al percorso del progetto
cd /d %~dp0

echo [1/4] Verifica PM2...
where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: PM2 non trovato. Installalo con: npm install -g pm2
    echo Dopo l'installazione, esegui: pm2-startup install
    pause
    exit /b 1
)

echo [2/4] Build del frontend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Build del frontend fallito
    pause
    exit /b 1
)

echo [3/4] Arresto processi PM2 precedenti...
pm2 delete dcs-warehouse 2>nul

echo [4/4] Avvio del server con PM2...
pm2 start backend/src/server.js --name dcs-warehouse

echo.
echo ========================================
echo Server avviato con PM2!
echo.
echo Comandi utili:
echo   pm2 status           - Stato del server
echo   pm2 logs dcs-warehouse - Visualizza log
echo   pm2 restart dcs-warehouse - Riavvia server
echo   pm2 stop dcs-warehouse - Ferma server
echo   pm2 delete dcs-warehouse - Rimuovi da PM2
echo.
echo Per salvare la configurazione PM2:
echo   pm2 save
echo.
echo Apri il browser: http://localhost:3001
echo ========================================
echo.

pm2 status

pause
