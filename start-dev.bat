@echo off
echo ============================================
echo   MachineMind AI — Development Startup
echo ============================================
echo.

echo [1/3] Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo Waiting 20 seconds for Docker to start...
timeout /t 20 /nobreak > nul

echo.
echo [2/3] Starting PostgreSQL database...
cd /d "%~dp0"
docker compose up db -d
echo Waiting 10 seconds for DB to be ready...
timeout /t 10 /nobreak > nul

echo.
echo [3/3] Starting FastAPI backend...
cd services\api
call .venv\Scripts\activate.bat
start cmd /k "uvicorn app.main:app --reload --port 8000"

echo.
echo [4/4] Starting Next.js frontend (already running or run manually)...
echo    cd apps\web ^&^& npm run dev
echo.
echo ============================================
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo   Frontend: http://localhost:3000
echo ============================================
pause
