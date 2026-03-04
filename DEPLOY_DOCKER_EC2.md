# CiviSense Docker Deployment on EC2

This deploys 3 containers on one EC2 instance:

- `website` (nginx static + reverse proxy) on port `80`
- `backend` (Node.js API) internal port `5000`
- `ai_service` (FastAPI) internal port `8000`

## 1. EC2 Prerequisites

Use Ubuntu or Amazon Linux with:

- Docker Engine
- Docker Compose plugin

Open security group ports:

- `22` from your IP
- `80` from public
- `443` from public (if adding HTTPS)

## 2. Clone Repository

```bash
cd /opt
sudo git clone <YOUR_REPO_URL> CIVISENCE
cd CIVISENCE
```

## 3. Configure Shared Env

Create the centralized env file used by both backend and AI:

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Set at least:

- `MONGO_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AWS_REGION`
- `AWS_BUCKET_NAME`
- `CORS_ORIGIN` (your website URL, e.g. `http://<ec2-public-ip>`)

Optional:

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (skip if using IAM role)
- `AI_MONITOR_API_KEY` (if you want protected AI health/stats endpoints)

## 4. Build and Start

```bash
docker compose -f docker-compose.ec2.yml up -d --build
```

Check status:

```bash
docker compose -f docker-compose.ec2.yml ps
docker compose -f docker-compose.ec2.yml logs -f backend
docker compose -f docker-compose.ec2.yml logs -f ai_service
docker compose -f docker-compose.ec2.yml logs -f website
```

## 5. Validate

From EC2:

```bash
curl http://localhost/
curl http://localhost/api/health
curl http://localhost/ai/health
```

If `AI_MONITOR_API_KEY` is set:

```bash
curl -H "x-ai-monitor-key: <AI_MONITOR_API_KEY>" http://localhost/ai/health
```

## 6. Update / Redeploy

```bash
cd /opt/CIVISENCE
git pull
docker compose -f docker-compose.ec2.yml up -d --build
```

## 7. Stop

```bash
docker compose -f docker-compose.ec2.yml down
```

## Notes

- Frontend container proxies:
  - `/api/*` -> backend
  - `/ai/*` -> AI service
- AI training folders persist in named volumes:
  - `ai_training_data`
  - `ai_training_runs`
- For HTTPS, add an ALB or host-level reverse proxy (Nginx/Caddy + certbot).
