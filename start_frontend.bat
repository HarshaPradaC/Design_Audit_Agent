@echo off
echo Starting Design Audit Agent Frontend...
echo.
cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo [+] Installing dependencies...
    npm install
    echo [+] Approving esbuild native binary install...
    npm install esbuild --foreground-scripts 2>nul
)

echo [+] Starting React dev server on http://localhost:5173
npm run dev
