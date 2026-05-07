# APK Upload Timeout Fix (15000ms Error)

## Problem
APK upload was timing out at **15 seconds** (15000ms) even though the file should upload.

## Root Cause
Multiple timeout configurations were too short:
1. **Axios Client Timeout:** 15 seconds (too short for 109 MB)
2. **Axios Upload Timeout:** 0 (not properly overriding)
3. **Node.js Server Timeout:** Default (2 minutes)
4. **Nginx Proxy Timeout:** Default (60 seconds)
5. **File Stream Timeout:** Not set

## Solutions Applied

### ✅ 1. Frontend - Axios Configuration
**File:** `frontend/CIVISENCE-WEBSITE/src/api/axios.js`
- **Before:** `timeout: 15000` (15 seconds)
- **After:** `timeout: 300000` (5 minutes)
- **Impact:** Global timeout for all requests

### ✅ 2. Frontend - APK Upload Endpoint
**File:** `frontend/CIVISENCE-WEBSITE/src/api/admin.js`
- **Before:** `timeout: 0` (might not override properly)
- **After:** `timeout: 900000` (15 minutes)
- **Impact:** Specific timeout for APK uploads

### ✅ 3. Backend - Node.js Server Timeout
**File:** `backend/src/server.js`
- **Added:** `server.setTimeout(900000);` (15 minutes)
- **Impact:** HTTP server socket timeout

### ✅ 4. Backend - File Stream Timeout
**File:** `backend/src/middlewares/uploadApk.middleware.js`
- **Added:** `fileStream.setTimeout(900000);`
- **Impact:** Individual file stream timeout

### ✅ 5. Nginx - Proxy Timeouts (EC2)
**Files:** `DEPLOY.md`, `scripts/ec2-setup.sh`
- **Added:**
  - `proxy_connect_timeout 900s;`
  - `proxy_send_timeout 900s;`
  - `proxy_read_timeout 900s;`
- **Impact:** Nginx reverse proxy timeout for large uploads

## Timeout Configuration Summary

| Component | Timeout | Purpose |
|-----------|---------|---------|
| Axios Global | 5 min (300s) | API requests |
| Axios APK Upload | 15 min (900s) | File uploads |
| Node.js Server | 15 min (900s) | Socket timeout |
| File Stream | 15 min (900s) | Individual stream |
| Nginx Connect | 15 min (900s) | Proxy connection |
| Nginx Send | 15 min (900s) | Proxy send |
| Nginx Read | 15 min (900s) | Proxy receive |

## Expected Upload Speed

For a **109 MB APK** file with typical internet speeds:

| Connection Speed | Upload Time | Status |
|-----------------|-------------|--------|
| 1 Mbps | ~14 minutes | ⚠️ Might timeout |
| 5 Mbps | ~2.8 minutes | ✅ OK |
| 10 Mbps | ~1.4 minutes | ✅ OK |
| 50 Mbps | ~17 seconds | ✅ OK |
| 100 Mbps | ~8 seconds | ✅ OK |

**Note:** 10-minute timeout should handle most upload scenarios.

## Files Modified

✅ `frontend/CIVISENCE-WEBSITE/src/api/axios.js` - Global timeout
✅ `frontend/CIVISENCE-WEBSITE/src/api/admin.js` - APK upload timeout  
✅ `backend/src/server.js` - Server socket timeout
✅ `backend/src/middlewares/uploadApk.middleware.js` - Stream timeout
✅ `DEPLOY.md` - Nginx configuration
✅ `scripts/ec2-setup.sh` - Nginx setup script

## Testing After Restart

### Local Development
```bash
# Restart backend
cd backend
npm start

# Try uploading APK through admin panel
```

### EC2 Deployment
```bash
# Redeploy with new configuration
DOMAIN=civisence.duckdns.org bash scripts/ec2-update.sh

# Verify Nginx config
sudo nginx -t
sudo systemctl reload nginx

# Check Nginx timeout settings
sudo grep -n "proxy.*timeout" /etc/nginx/conf.d/civisence.conf
```

## Debugging Upload Issues

If upload still fails, check:

1. **Network Speed:**
   ```bash
   # Test download speed
   curl -o /dev/null -s -w '%{speed_download}\n' https://example.com/file
   ```

2. **Backend Logs:**
   ```bash
   # Check for S3 errors
   pm2 logs civisense-backend | grep -i "s3\|upload\|error"
   ```

3. **Nginx Logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log | grep timeout
   ```

4. **AWS S3 Upload:**
   - Verify AWS credentials in `.env.backend.production`
   - Check S3 bucket permissions
   - Verify S3 endpoint URL (usually `https://s3.ap-south-1.amazonaws.com`)

## Performance Tips

1. **Upload from same region as S3:** Faster upload to AWS
2. **Use wired connection:** More stable than WiFi
3. **Compress APK:** Reduce file size before upload
4. **Check disk space:** Ensure EC2 has sufficient space
5. **Monitor server resources:** CPU, Memory, Disk I/O during upload
