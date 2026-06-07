@echo off
echo Starting Design Audit Agent Backend...
echo.

cd /d "%~dp0backend"

if not exist ".env" (
    copy .env.example .env
    echo [!] Created .env from example. Add your GEMINI_API_KEY before proceeding.
    pause
    exit /b 1
)

set PYTHONPATH=%~dp0backend

if exist "..\venv\Scripts\activate.bat" (
    call ..\venv\Scripts\activate.bat
) else (
    echo [!] Virtual environment not found. Run: py -3.12 -m venv venv ^& venv\Scripts\pip install -r backend/requirements.txt
    pause
    exit /b 1
)

echo [+] Starting FastAPI on http://localhost:8000
echo [+] API docs at http://localhost:8000/docs
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
