@echo off
cd /d "%~dp0backend"
title Industrial Platform - Backend :4000
echo Backend API: http://localhost:4000/api/v1/health
if not exist node_modules (
  echo Installing backend packages...
  call npm install
  if errorlevel 1 goto ON_ERROR
)
call npm run dev
if errorlevel 1 goto ON_ERROR
goto DONE
:ON_ERROR
echo.
echo [ERROR] Backend failed to start.
pause
exit /b 1
:DONE
pause
