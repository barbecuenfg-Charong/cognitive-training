@echo off
cd /d "%~dp0"
echo ==========================================================
echo           Starting Project Port Manager
echo ==========================================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] PowerShell is not found in your system PATH.
    echo Please install PowerShell.
    pause
    exit /b 1
)

echo Launching PowerShell script...
powershell -NoProfile -ExecutionPolicy Bypass -File "start_port_manager.ps1"

echo.
echo ==========================================================
echo           Execution Finished
echo ==========================================================
echo.
echo Press any key to close this window...
pause
