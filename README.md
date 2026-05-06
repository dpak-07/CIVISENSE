# CiviSense Monorepo

CiviSense is a civic issue reporting platform with:

- `backend`: Node.js/Express API (auth, complaints, routing, notifications)
- `ai_service`: FastAPI AI engine (priority scoring + duplicate intelligence)
- `frontend/CIVISENCE-WEBSITE`: React/Vite web app
- `frontend/CIVISENCE`: Expo mobile app

## Shared Environment Configuration

Environment variables are centralized in:

- `backend/.env`

Both backend and AI service read from this file by default.

1. Copy template:
```bash
cp backend/.env.example backend/.env
```
2. Fill required values (JWT secrets, Mongo URI, S3 bucket, etc.).

Optional override path:

- `CIVISENSE_ENV_FILE=/absolute/path/to/backend/.env`

## Local Run

### Backend
```bash
cd backend
npm ci
npm run dev
```

### AI Service
```bash
cd ai_service
./setup.ps1
uvicorn app.main:app --reload
```

### Web
```bash
cd frontend/CIVISENCE-WEBSITE
npm ci
npm run dev
```

## EC2 Production

Production env templates are provided for direct EC2/PM2 deployment:

- `backend/.env.ec2.production`
- `ai_service/.env.ec2.production`
- `frontend/CIVISENCE-WEBSITE/.env.ec2.production`
- `frontend/CIVISENCE/.env.ec2.production`

Copy the relevant template to `.env` inside that app folder, fill secrets and host names, then follow `DEPLOY.md`.

## Quality and CI

- Backend tests: `cd backend && npm test`
- Backend syntax lint: `cd backend && npm run lint`
- GitHub Actions CI: `.github/workflows/ci.yml`

## Notes

- AI monitoring endpoints support API-key protection via `AI_MONITOR_API_KEY`.
- Production CORS is strict; set `CORS_ORIGIN` explicitly.
- Build artifacts under `frontend/CIVISENCE-WEBSITE/dist` are not tracked.
- Full EC2 deployment guide: `DEPLOY.md`.
