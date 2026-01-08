@echo off
echo ========================================
echo  HYPIXEL BAN CHECKER - AUTO INSTALLER
echo ========================================
echo.

echo [1/3] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found! Please install Python from https://www.python.org/
    pause
    exit /b 1
)
echo [OK] Python found!
echo.

echo [2/3] Installing Python dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Python packages!
    pause
    exit /b 1
)
echo [OK] Python packages installed!
echo.

echo [3/3] Installing Node.js dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Node.js packages!
    pause
    exit /b 1
)
echo [OK] Node.js packages installed!
echo.

echo ========================================
echo  INSTALLATION COMPLETE!
echo ========================================
echo.
echo To start the app, run: npm start
echo Or double-click RUN.bat
echo.
pause
