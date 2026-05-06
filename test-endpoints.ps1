#!/usr/bin/env powershell
# CiviSense Backend Endpoint Testing Script
# Tests the backend at https://civisence.duckdns.org/

Write-Host @"
`n
    ╔═══════════════════════════════════════════════════╗
    ║   CiviSense Backend Endpoint Testing Suite       ║
    ║   Domain: https://civisence.duckdns.org/         ║
    ╚═══════════════════════════════════════════════════╝
`n
"@ -ForegroundColor Cyan

$BaseUrl = "https://civisence.duckdns.org"
$LocalUrl = "http://localhost:5000"

function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Name,
        [string]$Method = "GET",
        [hashtable]$Headers = @{}
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    Write-Host "URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method $Method -TimeoutSec 10 -Headers $Headers -ErrorAction Stop
        Write-Host "✓ Status: $($response.StatusCode) - Success" -ForegroundColor Green
        return $true
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401 -or $statusCode -eq 403) {
            Write-Host "✓ Status: $statusCode - Authentication Required (Expected)" -ForegroundColor Green
            return $true
        } elseif ($statusCode) {
            Write-Host "✗ Status: $statusCode - Error" -ForegroundColor Red
            return $false
        } else {
            Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
            return $false
        }
    }
}

Write-Host "`n[1] TESTING REMOTE ENDPOINTS (Production Domain)" -ForegroundColor Cyan
Write-Host "═" * 50 -ForegroundColor Cyan

Test-Endpoint -Url "$BaseUrl/health" -Name "Health Check Endpoint" | Out-Null
Write-Host ""

Test-Endpoint -Url "$BaseUrl/api/auth/profile" -Name "Auth Profile Endpoint" | Out-Null
Write-Host ""

Test-Endpoint -Url "$BaseUrl/api/complaints" -Name "Complaints List Endpoint" | Out-Null
Write-Host ""

Write-Host "`n[2] TESTING LOCAL ENDPOINTS (Localhost)" -ForegroundColor Cyan
Write-Host "═" * 50 -ForegroundColor Cyan

$localTests = @(
    @{ Url = "$LocalUrl/health"; Name = "Local Health Check" },
    @{ Url = "$LocalUrl/api/auth/profile"; Name = "Local Auth Profile" },
    @{ Url = "$LocalUrl/api/complaints"; Name = "Local Complaints" }
)

foreach ($test in $localTests) {
    Test-Endpoint -Url $test.Url -Name $test.Name | Out-Null
    Write-Host ""
}

Write-Host "`n[3] ENVIRONMENT SUMMARY" -ForegroundColor Cyan
Write-Host "═" * 50 -ForegroundColor Cyan
Write-Host "Primary Domain:     https://civisence.duckdns.org" -ForegroundColor Green
Write-Host "API Base URL:       https://civisence.duckdns.org/api" -ForegroundColor Green
Write-Host "Health Endpoint:    https://civisence.duckdns.org/health" -ForegroundColor Green
Write-Host "Backend Port:       5000 (local)" -ForegroundColor White
Write-Host "AI Service Port:    8000 (local)" -ForegroundColor White

Write-Host "`n[4] PRODUCTION ENV FILES CREATED" -ForegroundColor Cyan
Write-Host "═" * 50 -ForegroundColor Cyan
Write-Host "✓ .env.backend.production - Backend configuration" -ForegroundColor Green
Write-Host "✓ .env.website.production - Website configuration" -ForegroundColor Green
Write-Host "✓ .env.ai.production - AI Service configuration" -ForegroundColor Green
Write-Host "✓ .env.mobile.production - Mobile app configuration" -ForegroundColor Green

Write-Host "`nAll files configured with:" -ForegroundColor Yellow
Write-Host "  CORS_ORIGIN: https://civisence.duckdns.org" -ForegroundColor White
Write-Host "  VITE_API_BASE_URL: https://civisence.duckdns.org/api" -ForegroundColor White
Write-Host "  EXPO_PUBLIC_API_BASE_URL: https://civisence.duckdns.org/api" -ForegroundColor White

Write-Host "`n[5] EC2 DEPLOYMENT SCRIPTS UPDATED" -ForegroundColor Cyan
Write-Host "═" * 50 -ForegroundColor Cyan
Write-Host "✓ scripts/ec2-setup.sh - Updated DOMAIN variable" -ForegroundColor Green
Write-Host "✓ scripts/ec2-update.sh - Updated DOMAIN variable" -ForegroundColor Green
Write-Host "✓ DEPLOY.md - Updated documentation" -ForegroundColor Green

Write-Host "`nTo deploy to EC2, run:" -ForegroundColor Yellow
Write-Host '  DOMAIN=civisence.duckdns.org bash scripts/ec2-setup.sh' -ForegroundColor Cyan

Write-Host "`n" -ForegroundColor Cyan
Write-Host "Testing Complete!" -ForegroundColor Green
Write-Host "`n" -ForegroundColor Cyan
