Param(
    [int]$Port = 8000,
    [string]$Host = '0.0.0.0'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$venvActivate = Join-Path $root '.venv\Scripts\Activate.ps1'
if (Test-Path $venvActivate) {
    . $venvActivate
} else {
    Write-Host 'Warning: .venv not found. Using system Python.' -ForegroundColor Yellow
}

$env:PYTHONPATH = $root

if (-not (Get-Command uvicorn -ErrorAction SilentlyContinue)) {
    Write-Error 'uvicorn not found. Install with: python -m pip install -r requirements.txt'
    exit 1
}

uvicorn app.main:app --host $Host --port $Port --reload
