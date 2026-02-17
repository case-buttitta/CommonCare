@echo off
echo Starting CommonCare...

REM Stop any existing containers
docker compose down 2>nul

REM Build and start containers
docker compose up --build -d

REM Remove old volumes (optional, be cautious)
docker volume rm commoncare_db_data 2>nul

REM Wait for services to be ready
echo Waiting for services to start...
timeout /t 5 /nobreak >nul

REM Check if containers are running
docker compose ps | findstr "Up" >nul
if %errorlevel%==0 (
    echo.
    echo CommonCare is running!
    echo.
    echo Frontend: http://localhost:8080
    echo Backend API: http://localhost:5000/api/health
    echo Database: localhost:5432
    echo.
    
    REM Open browser
    start http://localhost:8080
) else (
    echo Failed to start containers. Check logs with: docker compose logs
)
