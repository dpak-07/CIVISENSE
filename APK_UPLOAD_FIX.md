# APK Upload Configuration Fix

## Issue
APK file upload failing with **0 B transferred** (114 MB APK).

## Root Causes Identified & Fixed

### 1. ✅ Express.js JSON Body Limit (FIXED)
**File:** `backend/src/app.js`
- **Before:** `1mb` limit
- **After:** `250mb` limit
- **Impact:** Global request size limit

### 2. ✅ Nginx Reverse Proxy Limit (FIXED)
**Files:** 
- `DEPLOY.md` (Step 9)
- `scripts/ec2-setup.sh` (configure_nginx function)

- **Before:** `client_max_body_size 20M;`
- **After:** `client_max_body_size 250M;`
- **Impact:** Reverse proxy upload limit on EC2

### 3. ✅ Busboy Middleware Limit (ALREADY OK)
**File:** `backend/src/middlewares/uploadApk.middleware.js`
- **Limit:** `MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024` (200 MB)
- **Status:** ✓ No changes needed

## Upload Configuration Summary

| Component | Limit | Status |
|-----------|-------|--------|
| Express Body | 250 MB | ✅ Updated |
| Nginx Client Max | 250 MB | ✅ Updated |
| Busboy File Size | 200 MB | ✅ OK |
| **Your APK Size** | **~109 MB** | ✅ **COMPATIBLE** |

## Endpoint Details

- **URL:** `https://civisence.duckdns.org/api/admin/dev-tools/app-config/upload-apk`
- **Method:** POST
- **Auth:** Requires `super_admin` role JWT token
- **Content-Type:** `multipart/form-data`
- **Field Name:** `apk` or `file`
- **Allowed Mime Types:**
  - `application/vnd.android.package-archive`
  - `application/octet-stream`
  - `application/zip`
  - `application/x-zip-compressed`
  - `application/java-archive`

## For EC2 Deployment

When deploying to EC2, the nginx configuration will be automatically set with the 250MB limit via:

```bash
DOMAIN=civisence.duckdns.org bash scripts/ec2-setup.sh
```

Or for updates:

```bash
DOMAIN=civisence.duckdns.org bash scripts/ec2-update.sh
```

## Testing After Deployment

1. Verify Express limit in local development:
   ```bash
   cd backend
   npm start
   ```

2. Verify Nginx limit on EC2:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. Test APK upload in admin panel:
   - Go to Admin → Dev Tools → App Config
   - Upload APK file (should work up to 200MB)

## Files Modified

- ✅ `backend/src/app.js` - Express body limit
- ✅ `DEPLOY.md` - Nginx configuration documentation
- ✅ `scripts/ec2-setup.sh` - Nginx setup script
