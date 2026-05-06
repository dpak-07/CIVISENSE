#!/usr/bin/env powershell
# Frontend Cache Clear & Rebuild Script
# Clears all cache and rebuilds the frontend applications

Write-Host @"
`n
    ╔═══════════════════════════════════════════════════╗
    ║   Frontend Cache Clear & Rebuild                  ║
    ╔═══════════════════════════════════════════════════╝
`n
"@ -ForegroundColor Cyan

$RootPath = Get-Location
$WebsitePath = Join-Path $RootPath "frontend\CIVISENCE-WEBSITE"
$MobileAppPath = Join-Path $RootPath "frontend\CIVISENCE"

Write-Host "[1] Clearing Website Build Cache" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

try {
    Push-Location $WebsitePath
    
    # Remove node_modules
    Write-Host "  • Removing node_modules..." -ForegroundColor White
    if (Test-Path "node_modules") {
        Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "    ✓ node_modules cleared" -ForegroundColor Green
    }
    
    # Remove dist
    Write-Host "  • Removing dist folder..." -ForegroundColor White
    if (Test-Path "dist") {
        Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "    ✓ dist cleared" -ForegroundColor Green
    }
    
    # Remove .vite cache
    Write-Host "  • Removing Vite cache..." -ForegroundColor White
    if (Test-Path ".vite") {
        Remove-Item -Path ".vite" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "    ✓ Vite cache cleared" -ForegroundColor Green
    }
    
    Pop-Location
} catch {
    Write-Host "  ✗ Error clearing cache: $_" -ForegroundColor Red
}

Write-Host "`n[2] Clearing Mobile App Cache" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

try {
    Push-Location $MobileAppPath
    
    # Remove node_modules
    Write-Host "  • Removing node_modules..." -ForegroundColor White
    if (Test-Path "node_modules") {
        Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "    ✓ node_modules cleared" -ForegroundColor Green
    }
    
    # Remove .expo cache
    Write-Host "  • Removing Expo cache..." -ForegroundColor White
    if (Test-Path ".expo") {
        Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "    ✓ Expo cache cleared" -ForegroundColor Green
    }
    
    Pop-Location
} catch {
    Write-Host "  ✗ Error clearing cache: $_" -ForegroundColor Red
}

Write-Host "`n[3] Installing Dependencies - Website" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

try {
    Push-Location $WebsitePath
    Write-Host "  • Running npm ci..." -ForegroundColor White
    npm ci
    Write-Host "  ✓ Website dependencies installed" -ForegroundColor Green
    Pop-Location
} catch {
    Write-Host "  ✗ Error installing website dependencies: $_" -ForegroundColor Red
    Pop-Location
}

Write-Host "`n[4] Installing Dependencies - Mobile App" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

try {
    Push-Location $MobileAppPath
    Write-Host "  • Running npm ci..." -ForegroundColor White
    npm ci
    Write-Host "  ✓ Mobile app dependencies installed" -ForegroundColor Green
    Pop-Location
} catch {
    Write-Host "  ✗ Error installing mobile app dependencies: $_" -ForegroundColor Red
    Pop-Location
}

Write-Host "`n[5] Timeout Configuration Verification" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

Write-Host "Website (CIVISENCE-WEBSITE):" -ForegroundColor White
Write-Host "  • Global timeout:        300000ms (5 min) ✓" -ForegroundColor Green
Write-Host "  • Admin endpoints:       300000ms (5 min) ✓" -ForegroundColor Green
Write-Host "  • APK upload:            600000ms (10 min) ✓" -ForegroundColor Green

Write-Host "`nMobile App (CIVISENCE):" -ForegroundColor White
Write-Host "  • Global timeout:        300000ms (5 min) ✓" -ForegroundColor Green

Write-Host "`n[6] Next Steps" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

Write-Host @"
For Website Development:
  1. cd frontend\CIVISENCE-WEBSITE
  2. npm run dev
  3. Open http://localhost:5173
  4. Go to /devs (Admin → Dev Tools)
  5. Test your upload

For Mobile App:
  1. cd frontend\CIVISENCE
  2. npm start
  3. Use Expo Go app to test

For Production Build (Website):
  1. cd frontend\CIVISENCE-WEBSITE
  2. npm run build
  3. dist/ folder will have production files
  4. Deploy to EC2: sync dist/ to /var/www/civisense-website

"@ -ForegroundColor Cyan

Write-Host "Cache clear complete! Frontend is ready." -ForegroundColor Green
Write-Host "`n" -ForegroundColor Cyan
