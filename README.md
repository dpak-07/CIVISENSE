# CiviSense Monorepo

CiviSense is a civic issue reporting platform with:

- `backend`: Node.js/Express API (auth, complaints, routing, notifications)
- `ai_service`: FastAPI AI engine (priority scoring + duplicate intelligence)
- `frontend/CIVISENCE-WEBSITE`: React/Vite web app
- `frontend/CIVISENCE`: Expo mobile app

This README is focused on **local development on Linux/macOS (non-Windows)**.

## Service Ports

- Backend API: `5000`
- AI Service: `8000`
- Web (Vite dev): `5173`

## Prerequisites (Linux/macOS)

Install the following before running:

- Git
- Node.js `20+` and npm
- Python `3.11` or `3.12`
- MongoDB (local or remote)

Verify versions:

```bash
node -v
npm -v
python3 --version
mongosh --version
```

## 1. Clone Repository

```bash
git clone <YOUR_REPO_URL> CIVISENCE
cd CIVISENCE
```

## 2. Configure Shared Environment (Important)

Environment variables are centralized in `backend/.env`.

Both `backend` and `ai_service` read from this file by default.

```bash
cp backend/.env.example backend/.env
```

Edit:

```bash
nano backend/.env
```

Set at least:

- `MONGO_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AWS_REGION`
- `AWS_BUCKET_NAME`
- `CORS_ORIGIN` (for local web: `http://localhost:5173`)

Optional:

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (skip if using IAM role in cloud)
- `AI_MONITOR_API_KEY` (protects AI monitoring endpoints if set)

Optional env override for AI/backend:

```bash
export CIVISENSE_ENV_FILE=/absolute/path/to/CIVISENCE/backend/.env
```

## 3. Start MongoDB

### Option A: Local MongoDB service
Start your MongoDB service using your distro/service manager.

Example:

```bash
sudo systemctl start mongod
sudo systemctl status mongod
```

### Option B: Remote MongoDB
If using remote DB, set `MONGO_URI` in `backend/.env`.

Note:
- AI change streams need Mongo replica set.
- If replica set is unavailable, AI continues with retry worker/polling behavior.

## 4. Install Dependencies

### Backend

```bash
cd backend
npm ci
cd ..
```

### AI Service

```bash
cd ai_service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install --only-binary=:all: -r requirements.txt
deactivate
cd ..
```

### Web

```bash
cd frontend/CIVISENCE-WEBSITE
npm ci
cd ../..
```

## 5. Run Locally (3 Terminals)

### Terminal 1: Backend

```bash
cd backend
npm run dev
```

### Terminal 2: AI Service

```bash
cd ai_service
source .venv/bin/activate
export CIVISENSE_ENV_FILE="$(pwd)/../backend/.env"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 3: Web

```bash
cd frontend/CIVISENCE-WEBSITE
npm run dev
```

## 6. Verify Services

From another terminal:

```bash
curl http://localhost:5000/health
curl http://localhost:8000/health
```

If `AI_MONITOR_API_KEY` is set:

```bash
curl -H "x-ai-monitor-key: <AI_MONITOR_API_KEY>" http://localhost:8000/health
```

Open web app:

- `http://localhost:5173`

## 7. Useful Commands

Backend checks:

```bash
cd backend
npm run lint
npm test
```

Web production build:

```bash
cd frontend/CIVISENCE-WEBSITE
npm run build
```

AI syntax sanity:

```bash
cd ai_service
python -m compileall app
```

## 8. Common Issues

Port already in use:

```bash
lsof -i :5000
lsof -i :8000
lsof -i :5173
```

Kill a process:

```bash
kill -9 <PID>
```

AI startup warning about replica set:
- This is expected if Mongo is standalone.
- AI can still process using retry/polling mode.

Missing/invalid env:
- Recheck `backend/.env`.
- Ensure `CIVISENSE_ENV_FILE` points to the correct file if overridden.

## Deployment Docs

- Docker on EC2: `DEPLOY_DOCKER_EC2.md`
- Full deployment guide: `DEPLOYMENT_README.md`

## Windows Note

If you are on Windows, use:

- `run_backend_ai.bat`

This README is intentionally Linux/macOS-first.
