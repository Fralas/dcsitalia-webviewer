@echo off
title DCS Italia Webviewer
cd /d "%~dp0"

echo.
echo  DCS Italia Webviewer
echo  ====================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo  ERRORE: Node.js / npm non trovato. Installa Node.js da https://nodejs.org
  pause
  exit /b 1
)

echo  Liberazione porte 3000 e 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo  Locale:   http://localhost:3000
echo  Esterno:  http://warehouse.dcs-italia.it:3000
echo.
echo  IMPORTANTE: usa http con :3000
echo  https://warehouse.dcs-italia.it (senza porta) = router Fritz, non il sito
echo.
echo  Premi Ctrl+C per fermare il server.
echo.

npm run dev

echo.
if errorlevel 1 (
  echo  Il server si e' arrestato con un errore.
) else (
  echo  Server arrestato.
)
pause
