# MachineMind AI — PowerShell Dev Startup
# Run from the machinemind-ai root: .\start-dev.ps1

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  MachineMind AI — Dev Startup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# 1. Start Docker Desktop if not running
$dockerRunning = docker info 2>&1 | Select-String "Server Version"
if (-not $dockerRunning) {
    Write-Host "`n[1] Starting Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "    Waiting 25 seconds for Docker..." -ForegroundColor Gray
    Start-Sleep -Seconds 25
} else {
    Write-Host "`n[1] Docker already running ✓" -ForegroundColor Green
}

# 2. Start PostgreSQL
Write-Host "`n[2] Starting PostgreSQL (pgvector)..." -ForegroundColor Yellow
docker compose up db -d
Start-Sleep -Seconds 8

# 3. Start FastAPI backend
Write-Host "`n[3] Starting FastAPI backend..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "services\api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; .venv\Scripts\activate; uvicorn app.main:app --reload --port 8000"

# 4. Start Next.js frontend
Write-Host "`n[4] Starting Next.js frontend..." -ForegroundColor Yellow
$webPath = Join-Path $PSScriptRoot "apps\web"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webPath'; npm run dev"

Start-Sleep -Seconds 3

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  ✓ All services started!" -ForegroundColor Green
Write-Host "" 
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:   http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Green
