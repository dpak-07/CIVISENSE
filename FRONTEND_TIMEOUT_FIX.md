# Frontend Timeout Fix - 15000ms Error

## Issue
The `/devs` (Dev Tools) page was showing **15000ms timeout error** despite updating axios configuration.

## Root Cause
Browser/build cache was still serving old files with the original 15000ms timeout.

## Solution Applied

### ✅ 1. Website (CIVISENCE-WEBSITE)
**File:** `frontend/CIVISENCE-WEBSITE/src/api/admin.js`
- Added explicit `timeout: 300000` to ALL admin API calls
- Ensures each endpoint has 5-minute timeout
- APK upload still has 10-minute timeout (600000ms)

### ✅ 2. Mobile App (CIVISENCE)
**File:** `frontend/CIVISENCE/lib/api.ts`
- Increased global timeout from `20000ms` → `300000ms` (5 minutes)
- Matches website timeout configuration

### ✅ 3. Global Axios Configuration
**File:** `frontend/CIVISENCE-WEBSITE/src/api/axios.js`
- Already set to `300000ms` (5 minutes)
- All requests inherit this timeout unless overridden

## Files Modified

| File | Change | Timeout |
|------|--------|---------|
| `src/api/admin.js` | Added explicit timeouts | 300000ms per call |
| `src/api/axios.js` | Global timeout | 300000ms |
| `lib/api.ts` (mobile) | Increased timeout | 300000ms |

## How to Fix on Your Machine

### Step 1: Clear Frontend Cache
```powershell
# Run the cache clear script
powershell -ExecutionPolicy Bypass -File clear-frontend-cache.ps1
```

Or manually:
```bash
# Website
cd frontend/CIVISENCE-WEBSITE
rm -rf node_modules dist .vite
npm ci

# Mobile App
cd frontend/CIVISENCE
rm -rf node_modules .expo
npm ci
```

### Step 2: Clear Browser Cache
- **Chrome:** Ctrl + Shift + Delete → Clear all time → Empty cache
- **Firefox:** Ctrl + Shift + Delete → Clear recent history → Everything
- **Safari:** Cmd + Option + E → Clear history

### Step 3: Run Development Server
```bash
cd frontend/CIVISENCE-WEBSITE
npm run dev
```

### Step 4: Test
1. Go to http://localhost:5173/devs
2. Login as super_admin
3. Try uploading APK or accessing Dev Tools
4. Should now work without 15000ms timeout

## For EC2 Production Deployment

### Option 1: Rebuild on EC2
```bash
cd /var/www/CIVISENSE/frontend/CIVISENCE-WEBSITE
rm -rf node_modules dist
npm ci
npm run build
sudo cp -r dist/* /var/www/civisense-website/
sudo chown -R nginx:nginx /var/www/civisense-website
sudo systemctl reload nginx
```

### Option 2: Deploy Pre-built Files
```bash
# Build locally
npm run build

# Upload dist/ to EC2
scp -r dist/* ec2-user@your-ec2-ip:/var/www/civisense-website/

# SSH and restart nginx
ssh ec2-user@your-ec2-ip
sudo chown -R nginx:nginx /var/www/civisense-website
sudo systemctl reload nginx
```

## Verification Checklist

✅ Clear browser cache (hard refresh: Ctrl+F5 or Cmd+Shift+R)
✅ Clear frontend build cache (node_modules, dist, .vite)
✅ Reinstall dependencies (npm ci)
✅ Restart dev server (npm run dev)
✅ Test `/devs` page without timeout errors
✅ Test APK upload functionality
✅ Test other admin endpoints

## If Still Getting Timeout

1. **Check Network Tab in Browser DevTools:**
   - F12 → Network tab
   - Reload page
   - Look for the request that times out
   - Should show full timeout value (300000ms = 5 min)

2. **Verify File Changes:**
   ```bash
   # Check website axios
   grep -n "timeout:" frontend/CIVISENCE-WEBSITE/src/api/axios.js
   # Should show: timeout: 300000
   
   # Check admin.js
   grep -n "timeout:" frontend/CIVISENCE-WEBSITE/src/api/admin.js
   # Should show: timeout: 300000 or 600000
   
   # Check mobile app
   grep -n "timeout:" frontend/CIVISENCE/lib/api.ts
   # Should show: timeout: 300000
   ```

3. **Check Backend is Running:**
   ```bash
   # Local development
   cd backend
   npm start
   
   # Verify health check
   curl http://localhost:5000/health
   ```

4. **Check if Using Correct URL:**
   - Local: http://localhost:5173/devs
   - Production: https://civisence.duckdns.org/devs

## Expected Behavior After Fix

| Scenario | Expected Time | Status |
|----------|----------------|--------|
| Load Dev Tools page | < 5 seconds | ✅ OK |
| Load 100+ users | < 10 seconds | ✅ OK |
| Upload 109 MB APK | < 10 minutes | ✅ OK |
| Create/edit user | < 2 seconds | ✅ OK |
| Delete user | < 2 seconds | ✅ OK |

## Technical Details

### Timeout Hierarchy (Website)
1. **Per-request timeout** (if specified): `timeout: X`
2. **Axios instance timeout** (fallback): 300000ms
3. **Browser timeout** (max): Usually 10+ minutes

### Request with Explicit Timeout
```javascript
// This ALWAYS uses 300000ms, never the default
api.get('/admin/dev-tools', { timeout: 300000 });
```

### Request Using Default Timeout
```javascript
// This uses axios instance default (300000ms)
api.get('/some-endpoint');
```

## Browser Cache Busting

If changes still don't show after clearing cache:

### Vite Dev Server
- Automatically hot-reloads changes
- No manual rebuild needed during `npm run dev`
- Just save file and refresh browser

### Production Build
```bash
# Force rebuild
npm run build

# Or clean rebuild
rm -rf dist && npm run build
```

## Notes

- **5-minute timeout (300000ms):** Suitable for most API calls
- **10-minute timeout (600000ms):** For large file uploads (APK, media)
- **Mobile app:** Now synced with website timeout values
- **EC2 Nginx:** Also configured with 10-minute proxy timeout (see DEPLOY.md)
