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

## Docker Production

For an EC2/container deployment, copy the Docker env template and start the stack:

```bash
cp .env.docker.example .env
# Fill the required blank values in .env first.
docker compose up -d --build
```

Full EC2 steps are in `DEPLOY_DOCKER_EC2.md`.

For a brand-new EC2 instance, start with `EC2_FRESH_INSTANCE_README.md`.

## Quality and CI

- Backend tests: `cd backend && npm test`
- Backend syntax lint: `cd backend && npm run lint`
- GitHub Actions CI: `.github/workflows/ci.yml`

## Notes

- AI monitoring endpoints support API-key protection via `AI_MONITOR_API_KEY`.
- Production CORS is strict; set `CORS_ORIGIN` explicitly.
- Build artifacts under `frontend/CIVISENCE-WEBSITE/dist` are not tracked.
- Docker on EC2 guide: `DEPLOY_DOCKER_EC2.md`.
- Full deployment README: `DEPLOYMENT_README.md`.
