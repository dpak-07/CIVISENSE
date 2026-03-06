param(
    [string]$RootPath = "."
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return @{}
    }

    $map = @{}
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim()
        $map[$key] = $value
    }
    return $map
}

function Assert-Keys {
    param(
        [string]$Name,
        [string]$Path,
        [string[]]$RequiredKeys
    )

    $values = Read-EnvFile -Path $Path
    $missing = @()
    foreach ($k in $RequiredKeys) {
        if (-not $values.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($values[$k])) {
            $missing += $k
        }
    }

    if ($missing.Count -gt 0) {
        Write-Host "[FAIL] $Name -> Missing keys: $($missing -join ', ')" -ForegroundColor Red
        return $false
    }

    Write-Host "[OK]   $Name -> $Path" -ForegroundColor Green
    return $true
}

$checks = @(
    @{
        Name = "Backend";
        Path = Join-Path $RootPath "backend/.env.production";
        Keys = @(
            "MONGO_URI",
            "JWT_ACCESS_SECRET",
            "JWT_REFRESH_SECRET",
            "AWS_REGION",
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_BUCKET_NAME",
            "SMTP_USER",
            "SMTP_PASS"
        )
    },
    @{
        Name = "AI Service";
        Path = Join-Path $RootPath "ai_service/.env.production";
        Keys = @(
            "MONGO_URI",
            "MONGO_DB_NAME",
            "AWS_REGION",
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_BUCKET_NAME",
            "YOLO_MODEL_NAME"
        )
    },
    @{
        Name = "Website";
        Path = Join-Path $RootPath "frontend/CIVISENCE-WEBSITE/.env.production";
        Keys = @("VITE_API_BASE_URL")
    },
    @{
        Name = "Mobile App";
        Path = Join-Path $RootPath "frontend/CIVISENCE/.env.production";
        Keys = @(
            "EXPO_PUBLIC_API_BASE_URL",
            "EXPO_PUBLIC_API_BASE_URLS",
            "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
        )
    }
)

$allGood = $true
foreach ($check in $checks) {
    $ok = Assert-Keys -Name $check.Name -Path $check.Path -RequiredKeys $check.Keys
    if (-not $ok) { $allGood = $false }
}

if (-not $allGood) {
    exit 1
}

Write-Host "`nAll production env checks passed." -ForegroundColor Cyan
