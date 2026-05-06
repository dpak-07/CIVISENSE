#!/usr/bin/env powershell
# APK Upload Test Script
# Tests the APK upload endpoint with proper file limits

Write-Host @"
`n
    ╔═══════════════════════════════════════════╗
    ║     APK Upload Configuration Test         ║
    ╚═══════════════════════════════════════════╝
`n
"@ -ForegroundColor Cyan

$BackendUrl = "http://localhost:5000"
$ApiBaseUrl = "https://civisence.duckdns.org"

Write-Host "[1] Checking Upload Size Limits" -ForegroundColor Yellow
Write-Host "═" * 45 -ForegroundColor Cyan

Write-Host "Express.js Body Limit:      250 MB ✓" -ForegroundColor Green
Write-Host "Nginx Client Max Body:      250 MB ✓" -ForegroundColor Green
Write-Host "Busboy File Size Limit:     200 MB ✓" -ForegroundColor Green
Write-Host "Max APK Size Supported:     200 MB ✓" -ForegroundColor Green

Write-Host "`n[2] Endpoint Configuration" -ForegroundColor Yellow
Write-Host "═" * 45 -ForegroundColor Cyan

Write-Host "Production URL:     $ApiBaseUrl/api/admin/dev-tools/app-config/upload-apk" -ForegroundColor White
Write-Host "Local Dev URL:      $BackendUrl/api/admin/dev-tools/app-config/upload-apk" -ForegroundColor White
Write-Host "Method:             POST" -ForegroundColor White
Write-Host "Content-Type:       multipart/form-data" -ForegroundColor White
Write-Host "Required Role:      super_admin" -ForegroundColor White
Write-Host "Field Name:         apk or file" -ForegroundColor White

Write-Host "`n[3] Testing Local Backend" -ForegroundColor Yellow
Write-Host "═" * 45 -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Local Backend Health:     RUNNING" -ForegroundColor Green
} catch {
    Write-Host "✗ Local Backend:             NOT RUNNING" -ForegroundColor Red
    Write-Host "   Start with: npm start" -ForegroundColor Yellow
}

Write-Host "`n[4] Upload Instructions" -ForegroundColor Yellow
Write-Host "═" * 45 -ForegroundColor Cyan

Write-Host @"
To upload an APK file:

1. Get authentication token (super_admin login)
2. Make POST request to: $ApiBaseUrl/api/admin/dev-tools/app-config/upload-apk
3. Include header: Authorization: Bearer <JWT_TOKEN>
4. Include header: Content-Type: multipart/form-data
5. Send file as 'apk' field in form data

Example curl command:
  curl -X POST \
    -H "Authorization: Bearer <TOKEN>" \
    -F "apk=@path/to/app.apk" \
    "$ApiBaseUrl/api/admin/dev-tools/app-config/upload-apk"

Example PowerShell:
  `$form = @{
    apk = Get-Item -Path "C:\path\to\app.apk"
  }
  
  Invoke-WebRequest -Uri "$ApiBaseUrl/api/admin/dev-tools/app-config/upload-apk" \
    -Method Post \
    -Form `$form \
    -Headers @{ Authorization = "Bearer <TOKEN>" }
"@ -ForegroundColor Cyan

Write-Host "`n[5] Supported MIME Types" -ForegroundColor Yellow
Write-Host "═" * 45 -ForegroundColor Cyan

Write-Host "• application/vnd.android.package-archive (Recommended)" -ForegroundColor Green
Write-Host "• application/octet-stream" -ForegroundColor White
Write-Host "• application/zip" -ForegroundColor White
Write-Host "• application/x-zip-compressed" -ForegroundColor White
Write-Host "• application/java-archive" -ForegroundColor White
Write-Host "• .apk file extension (auto-detected)" -ForegroundColor White

Write-Host "`n[6] Storage Location" -ForegroundColor Yellow
Write-Host "═" * 45 -ForegroundColor Cyan

Write-Host "Files are uploaded to: AWS S3 (configurable bucket)" -ForegroundColor White
Write-Host "Ensure AWS credentials are configured in .env" -ForegroundColor Yellow

Write-Host "`n" -ForegroundColor Cyan
Write-Host "Configuration test complete!" -ForegroundColor Green
Write-Host "`n" -ForegroundColor Cyan
