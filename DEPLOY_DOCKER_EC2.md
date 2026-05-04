# CiviSense Docker Deployment on EC2

This runs the production web app, backend API, AI service, and MongoDB as Docker containers on one EC2 instance.

## Services

- `frontend`: Nginx serving the Vite build and proxying `/api` and `/ai`
- `backend`: Node.js/Express API on the internal Docker network
- `ai-service`: FastAPI/Uvicorn AI worker/API on the internal Docker network
- `mongo`: MongoDB 7 with a single-node replica set and persistent Docker volume

## EC2 Setup

Use an instance with enough memory for the AI models. Start with at least 4 GB RAM; 8 GB is safer for first boot/model downloads.

Open security group inbound rules:

- `22` from your IP
- `80` from the internet or your load balancer
- `443` if you terminate TLS on the instance or a reverse proxy

Install Docker and the Compose plugin:

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
newgrp docker
docker compose version
```

## Deploy

```bash
git clone <YOUR_GIT_REPO_URL> CIVISENSE
cd CIVISENSE
cp .env.docker.example .env
nano .env
```

Fill at minimum:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_BUCKET_NAME`
- `CORS_ORIGIN` with your real origin, for example `https://your-domain.com`

Start the stack:

```bash
docker compose up -d --build
docker compose ps
```

First startup can take several minutes because the AI service downloads model files. Watch logs:

```bash
docker compose logs -f ai-service
docker compose logs -f backend
```

Check health:

```bash
curl http://localhost/health
curl http://localhost/ai/health
```

## Seed Data

If you need the JSON seed data in `database/`, mount it only for the seed command:

```bash
docker compose run --rm -v "$PWD/database:/database:ro" backend npm run seed:developers
docker compose run --rm -v "$PWD/database:/database:ro" backend npm run seed:complaints
docker compose run --rm -v "$PWD/database:/database:ro" backend npm run seed:users
```

## Update

```bash
git pull
docker compose up -d --build
docker image prune -f
```

## Operations

```bash
docker compose ps
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f ai-service
docker compose restart backend
docker compose down
```

MongoDB data is stored in the `mongo_data` Docker volume. Do not run `docker compose down -v` unless you intentionally want to delete production data.

## HTTPS

The included Compose file exposes HTTP on `HTTP_PORT` and keeps backend, AI, and MongoDB private inside Docker. For HTTPS, put an AWS Application Load Balancer, CloudFront, Caddy, or host Nginx in front of this stack and forward traffic to the EC2 instance on port `80`.
