#!/usr/bin/env powershell
# APK Upload Timeout Debugging Script

Write-Host @"
`n
    ╔═══════════════════════════════════════════╗
    ║   APK Upload Timeout Debugging Suite      ║
    ╚═══════════════════════════════════════════╝
`n
"@ -ForegroundColor Cyan

Write-Host "[1] Timeout Configuration Check" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

Write-Host "Frontend (Axios) Timeouts:" -ForegroundColor White
Write-Host "  • Global timeout:        300000ms (5 minutes) ✓" -ForegroundColor Green
Write-Host "  • APK upload timeout:    600000ms (10 minutes) ✓" -ForegroundColor Green

Write-Host "`nBackend (Node.js) Timeouts:" -ForegroundColor White
Write-Host "  • Server socket timeout: 600000ms (10 minutes) ✓" -ForegroundColor Green
Write-Host "  • File stream timeout:   600000ms (10 minutes) ✓" -ForegroundColor Green

Write-Host "`nNginx Proxy Timeouts (EC2):" -ForegroundColor White
Write-Host "  • Connect timeout:       600s (10 minutes) ✓" -ForegroundColor Green
Write-Host "  • Send timeout:          600s (10 minutes) ✓" -ForegroundColor Green
Write-Host "  • Read timeout:          600s (10 minutes) ✓" -ForegroundColor Green

Write-Host "`n[2] Network Speed Estimation" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

Write-Host "For a 109 MB APK file upload time estimates:" -ForegroundColor White
Write-Host "  1 Mbps  →  ~14 minutes  (⚠️ Might exceed timeout)" -ForegroundColor Yellow
Write-Host "  5 Mbps  →  ~2.8 minutes (✓ OK)" -ForegroundColor Green
Write-Host "  10 Mbps →  ~1.4 minutes (✓ OK)" -ForegroundColor Green
Write-Host "  50 Mbps →  ~17 seconds  (✓ OK)" -ForegroundColor Green

Write-Host "`nTo test your connection speed:" -ForegroundColor Cyan
Write-Host "  1. Use fast.com or speedtest.net" -ForegroundColor White
Write-Host "  2. Check 'Upload Speed'" -ForegroundColor White
Write-Host "  3. Ensure upload speed is > 1 Mbps" -ForegroundColor White

Write-Host "`n[3] Checking Local Backend" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

$BackendUrl = "http://localhost:5000"
try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Local Backend Status: RUNNING" -ForegroundColor Green
    Write-Host "  URL: $BackendUrl" -ForegroundColor Green
} catch {
    Write-Host "✗ Local Backend Status: NOT RUNNING" -ForegroundColor Red
    Write-Host "  Action: Start backend with 'npm start'" -ForegroundColor Yellow
}

Write-Host "`n[4] Common Issues & Solutions" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

Write-Host @"
Issue 1: Still getting 15000ms timeout
Solution:
  □ Clear browser cache (Ctrl+Shift+Delete)
  □ Rebuild frontend: npm run build
  □ Restart backend: npm start
  □ Check browser console (F12) for errors

Issue 2: Upload starts but fails halfway
Solution:
  □ Check internet speed (should be > 1 Mbps)
  □ Check AWS credentials in .env
  □ Verify S3 bucket has write permissions
  □ Check backend logs: npm logs

Issue 3: "Failed to upload file to storage"
Solution:
  □ Verify AWS_REGION in .env
  □ Verify AWS_ACCESS_KEY_ID is valid
  □ Verify AWS_SECRET_ACCESS_KEY is valid
  □ Verify AWS_BUCKET_NAME exists
  □ Test S3 access manually

Issue 4: Nginx 504 error on EC2
Solution:
  □ Verify Nginx config: sudo nginx -t
  □ Check backend is running: pm2 list
  □ Verify backend is accessible: curl http://127.0.0.1:5000/health
  □ Check Nginx logs: sudo tail -f /var/log/nginx/error.log

"@ -ForegroundColor Cyan

Write-Host "[5] Files to Check" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

Write-Host "Frontend Files:" -ForegroundColor White
Write-Host "  • frontend/CIVISENCE-WEBSITE/src/api/axios.js" -ForegroundColor Cyan
Write-Host "  • frontend/CIVISENCE-WEBSITE/src/api/admin.js" -ForegroundColor Cyan

Write-Host "`nBackend Files:" -ForegroundColor White
Write-Host "  • backend/src/server.js" -ForegroundColor Cyan
Write-Host "  • backend/src/middlewares/uploadApk.middleware.js" -ForegroundColor Cyan
Write-Host "  • backend/.env (AWS credentials)" -ForegroundColor Cyan

Write-Host "`nEC2 Configuration:" -ForegroundColor White
Write-Host "  • /etc/nginx/conf.d/civisence.conf" -ForegroundColor Cyan
Write-Host "  • /var/www/CIVISENSE/.env.backend.production" -ForegroundColor Cyan

Write-Host "`n[6] Testing Upload Manually" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

Write-Host @"
PowerShell Example:
  `$apkFile = "C:\path\to\your\app.apk"
  `$token = "YOUR_JWT_TOKEN"
  
  `$form = @{ apk = Get-Item -Path `$apkFile }
  
  Invoke-WebRequest `
    -Uri "https://civisence.duckdns.org/api/admin/dev-tools/app-config/upload-apk" `
    -Method Post `
    -Form `$form `
    -Headers @{ Authorization = "Bearer `$token" } `
    -TimeoutSec 600

cURL Example:
  curl -X POST \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -F "apk=@C:\path\to\app.apk" \
    "https://civisence.duckdns.org/api/admin/dev-tools/app-config/upload-apk"
"@ -ForegroundColor Green

Write-Host "`n[7] Next Steps" -ForegroundColor Yellow
Write-Host "═" * 50 -ForegroundColor Cyan

Write-Host @"
1. Verify all files are updated
2. Restart backend: npm start
3. Rebuild frontend: npm run build (if in production)
4. Test upload in admin panel
5. If still failing, check browser console for exact error
6. Review backend logs: npm logs civisense-backend
7. For EC2, redeploy: DOMAIN=civisence.duckdns.org bash scripts/ec2-update.sh

"@ -ForegroundColor Cyan

Write-Host "Configuration check complete!" -ForegroundColor Green
Write-Host "`n" -ForegroundColor Cyan
