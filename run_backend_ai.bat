@echo off
setlocal

if /I "%~1"=="backend" goto :backend_mode
if /I "%~1"=="ai" goto :ai_mode

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "AI_DIR=%ROOT_DIR%\ai_service"

if not exist "%BACKEND_DIR%" (
  echo [ERROR] Backend directory not found: "%BACKEND_DIR%"
  exit /b 1
)

if not exist "%AI_DIR%" (
  echo [ERROR] AI service directory not found: "%AI_DIR%"
  exit /b 1
)

echo Starting CiviSense services in separate terminals...
start "CiviSense Backend" "%SystemRoot%\System32\cmd.exe" /k ""%~f0" backend"
start "CiviSense AI Service" "%SystemRoot%\System32\cmd.exe" /k ""%~f0" ai"
echo Done.
exit /b 0

:backend_mode
setlocal
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "BACKEND_PORT=5000"

call :check_port_in_use %BACKEND_PORT% BACKEND_PORT_PID
if defined BACKEND_PORT_PID (
  echo [ERROR] Port %BACKEND_PORT% is already in use ^(PID: %BACKEND_PORT_PID%^).
  echo Close the existing process or change backend port in backend\.env, then retry.
  pause
  exit /b 1
)

cd /d "%BACKEND_DIR%"
echo [CiviSense Backend] Starting dev server...
npm run dev

echo.
echo [CiviSense Backend] Process exited.
pause
exit /b 0

:ai_mode
setlocal
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "AI_DIR=%ROOT_DIR%\ai_service"
set "BACKEND_ENV=%ROOT_DIR%\backend\.env"
set "AI_ACTIVATE=%AI_DIR%\.venv\Scripts\activate.bat"
set "AI_PORT=8000"

call :check_port_in_use %AI_PORT% AI_PORT_PID
if defined AI_PORT_PID (
  echo [ERROR] Port %AI_PORT% is already in use ^(PID: %AI_PORT_PID%^).
  echo Close the existing process or change AI port in this script, then retry.
  pause
  exit /b 1
)

cd /d "%AI_DIR%"
set "CIVISENSE_ENV_FILE=%BACKEND_ENV%"

if exist "%AI_ACTIVATE%" (
  call "%AI_ACTIVATE%"
) else (
  echo [WARN] Virtual environment not found at "%AI_ACTIVATE%". Using system Python.
)

echo [CiviSense AI] Starting uvicorn...
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port %AI_PORT%

echo.
echo [CiviSense AI] Process exited.
pause
exit /b 0

:check_port_in_use
setlocal
set "PORT=%~1"
set "FOUND_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  set "FOUND_PID=%%P"
  goto :check_done
)

:check_done
endlocal & set "%~2=%FOUND_PID%"
exit /b 0
