@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

if exist ".venv\Scripts\activate.bat" (
  call ".venv\Scripts\activate.bat"
) else (
  echo Warning: .venv not found. Using system Python.
)

set "PYTHONPATH=%CD%"

where uvicorn >nul 2>nul
if errorlevel 1 (
  echo uvicorn not found. Install with: python -m pip install -r requirements.txt
  exit /b 1
)

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
