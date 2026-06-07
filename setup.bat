@echo off
echo ==========================================
echo  Design Audit Agent — First-Time Setup
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/5] Creating Python 3.12 virtual environment...
py -3.12 -m venv venv
if errorlevel 1 (
    echo ERROR: Python 3.12 not found. Install from python.org
    pause
    exit /b 1
)

echo [2/5] Installing Python dependencies...
venv\Scripts\pip install -r backend\requirements.txt
if errorlevel 1 (
    echo ERROR: pip install failed
    pause
    exit /b 1
)

echo [3/5] Installing Playwright browsers...
venv\Scripts\playwright install chromium

echo [4/5] Setting up environment file...
if not exist "backend\.env" (
    copy backend\.env.example backend\.env
    echo.
    echo [!] IMPORTANT: Edit backend\.env and add your GEMINI_API_KEY
    echo     File created at: %~dp0backend\.env
)

echo [5/5] Installing frontend dependencies...
cd frontend
npm install
cd ..

echo.
echo ==========================================
echo  Setup Complete!
echo ==========================================
echo.
echo Next steps:
echo  1. Add GEMINI_API_KEY to backend\.env
echo  2. Run start_backend.bat  (terminal 1)
echo  3. Run start_frontend.bat (terminal 2)
echo  4. Open http://localhost:5173
echo.
pause
