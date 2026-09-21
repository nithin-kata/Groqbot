@echo off
echo ===================================================
echo        Groq AI Chatbot - Flask Setup & Launcher
echo ===================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in PATH!
    echo Please install Python 3.9+ from https://www.python.org/
    pause
    exit /b 1
)

REM Check if .env exists, if not copy .env.example
if not exist ".env" (
    echo [INFO] .env not found. Creating from .env.example...
    copy .env.example .env
    echo [IMPORTANT] Please open .env and put your GROQ_API_KEY!
)

REM Install dependencies
echo [1/2] Installing required dependencies...
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] Problem installing dependencies. Proceeding to attempt launch...
)

REM Launch Flask app
echo [2/2] Starting Flask Chatbot Server...
echo Visit http://localhost:5000 in your browser.
echo.
python app.py
pause
