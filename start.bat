@echo off
color 0B
echo ==========================================
echo       STARTING ARAB AC ERP SYSTEM
echo ==========================================

echo [1/2] Starting Local Database Server (Port 3001)...
start cmd /k "cd backend && node server.js"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend App (Network Mode)...
start cmd /k "cd frontend && npm run dev -- --host"

echo.
echo ==========================================
echo System is running!
echo To open from other devices (Phones/LAN):
echo Look for the Network IP Address in the new window.
echo ==========================================
pause