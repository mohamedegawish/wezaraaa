@echo off
cd /d "%~dp0"
title Egyptian Industrial Initiatives Platform

echo ======================================================================
echo    Arab Republic of Egypt - Ministry of Industry
echo    National Industrial Initiatives Platform (Prototype Demo)
echo ======================================================================
echo.

if not exist frontend\node_modules goto DO_INSTALL
goto RUN_APP

:DO_INSTALL
echo [1/2] Installing required packages (frontend/npm install)...
cd frontend
call npm install
if errorlevel 1 goto ON_ERROR
cd /d "%~dp0"

:RUN_APP
echo [2/2] Launching platform and opening browser...
echo Frontend: http://localhost:3000 (API=http://localhost:4000 via frontend/.env)
echo Backend : cd backend ^&^& npm run dev  -- http://localhost:4000
echo.
echo ======================================================================
echo.

cd frontend
call npm run dev -- --open
if errorlevel 1 goto ON_ERROR
goto DONE

:ON_ERROR
echo.
echo [ERROR] Failed to run the platform.
pause
exit /b 1

:DONE
pause
