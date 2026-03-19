# CiviSense Backend Status and API Docs

Last updated: 2026-03-06

## 1) Current Backend Status

### Overall
- Status: **Functional**
- API base path: `/api`
- Health endpoint: `GET /health`
- Auth mode: JWT access + refresh tokens
- Database: MongoDB (Mongoose)
- Storage: AWS S3 (image uploads / APK upload in dev tools)
- Notifications: DB notifications + optional Firebase push

### Feature Readiness
- Authentication (register/login/refresh/logout): **Done**
- OTP registration flow: **Done**
- Complaint create/list/detail/delete: **Done**
- Complaint status workflow (assigned/in_progress/resolved/rejected): **Done**
- Duplicate detection + master/duplicate linking: **Done**
- AI watcher notifications (change stream with polling fallback): **Done**
- Misuse reporting and auto-blacklist threshold: **Done**
- Municipal office CRUD: **Done**
- Sensitive locations CRUD + public fetch: **Done**
- Admin dashboard metrics + analytics payload: **Done**
- Developer tools (`/admin/dev-tools`) + developer profile CMS: **Done**
- Public app config + developers endpoint: **Done**
- Automated test suite: **Not implemented**

## 2) Runtime Check Performed

- Local module boot check passed:
  - Command (from `backend`): `node -e "require('./src/app'); console.log('backend app module loaded');"`
  - Result: app module loaded successfully.

Notes:
- Full server run still depends on valid MongoDB and environment variables.
- Server boot sequence starts DB connection and AI watcher.

## 3) API Endpoint Map

All endpoints below are under `/api` unless stated otherwise.

### Health
- `GET /health`

### Auth
- `POST /auth/register/request-otp`
- `POST /auth/register/verify-otp`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### Complaints (auth required)
- `POST /complaints` (with complaint image upload support)
- `GET /complaints`
- `GET /complaints/:id`
- `DELETE /complaints/:id`
- `PATCH /complaints/:id/status` (officer/admin/super_admin)
- `PATCH /complaints/:id/report-user` (officer/admin/super_admin)

### Municipal Offices (auth required)
- `POST /municipal-offices` (super_admin)
- `GET /municipal-offices`
- `PATCH /municipal-offices/:id` (super_admin)
- `DELETE /municipal-offices/:id` (super_admin)

### Sensitive Locations (auth required)
- `GET /sensitive-locations` (admin/super_admin)
- `POST /sensitive-locations` (super_admin)
- `PATCH /sensitive-locations/:id` (super_admin)
- `DELETE /sensitive-locations/:id` (super_admin)

### Notifications (auth required)
- `GET /notifications`
- `PATCH /notifications/:id/read`

### Users (auth required)
- `POST /users/profile-photo`
- `DELETE /users/profile-photo`
- `PATCH /users/preferences/language`
- `DELETE /users/account`

### Admin (auth required)
- `GET /admin/dashboard` (admin/super_admin)
- `GET /admin/dev-tools` (super_admin)
- `PATCH /admin/dev-tools/app-config` (super_admin)
- `POST /admin/dev-tools/app-config/upload-apk` (super_admin)
- `GET /admin/dev-tools/developers` (super_admin)
- `POST /admin/dev-tools/developers` (super_admin)
- `PATCH /admin/dev-tools/developers/:id` (super_admin)
- `DELETE /admin/dev-tools/developers/:id` (super_admin)
- `PATCH /admin/dev-tools/users/:id` (super_admin)
- `DELETE /admin/dev-tools/users/:id` (super_admin)

### Public
- `POST /public/contact`
- `GET /public/app-config`
- `GET /public/sensitive-locations`
- `GET /public/developers`
- `GET /developers` (alias route)

## 4) Roles and Access

- `citizen`: can create and manage own complaints (with restrictions), view own context.
- `officer`: can process assigned complaints and report misuse.
- `admin`: dashboard + elevated complaint operations.
- `super_admin`: full admin/dev-tools control, office/location/config/user/developer management.

## 5) Core Data Models (Logical)

- `User`
- `EmailOtp`
- `Complaint`
- `MunicipalOffice`
- `SensitiveLocation`
- `Notification`
- `UserMisuseReport`
- `BlacklistedUser`
- `SystemConfig`
- `DeveloperProfile`

## 6) Environment Checklist

### Required (hard fail if missing)
- `MONGO_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_BUCKET_NAME`

### Recommended / Optional
- `PORT`, `NODE_ENV`, `CORS_ORIGIN`
- `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CONTACT_TO_EMAIL`
- `MISUSE_REPORT_THRESHOLD`
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH` (for push notifications)

## 7) Setup and Seed Commands

From `backend`:

```bash
npm install
npm run dev
```

Seed users / developers:

```bash
npm run seed:users
npm run seed:developers
# alias:
npm run devs
```

Main database seed (municipal offices, sensitive locations, system config):

```bash
python database/seed_data.py
```

## 8) Known Gaps / Improvements

- No automated backend tests currently.
- No OpenAPI/Swagger generation yet.
- `GET /health` checks service availability only; does not perform DB dependency health checks.
- There is both `/api/public/developers` and `/api/developers` (intentional alias; keep only one if you want stricter API surface).

## 9) Important File References

- App boot/middleware: `backend/src/app.js`
- Server startup/shutdown: `backend/src/server.js`
- Route mounting: `backend/src/routes/index.js`
- Env validation: `backend/src/config/env.js`
- Complaint logic: `backend/src/services/complaintService.js`
- AI watcher: `backend/src/services/complaintAiWatcher.service.js`
- Admin/dev tools logic: `backend/src/services/adminService.js`
- Notification delivery: `backend/src/services/notification.service.js`

