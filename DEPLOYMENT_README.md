# Deployment README (EC2 + Docker)

This project is deployed as 3 containers on one EC2 instance:

- `website` (nginx + static frontend) on port `80`
- `backend` (Node API) internal port `5000`
- `ai_service` (FastAPI) internal port `8000`

Compose file used:

- `docker-compose.ec2.yml`

## 1. Prepare EC2

Use Ubuntu 22.04+ or Amazon Linux 2023.

Open EC2 security-group inbound rules:

- `22` from your IP
- `80` from public
- `443` from public (if enabling HTTPS)

## 2. Install Docker and Compose

### Ubuntu
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin git
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```

### Amazon Linux 2023
```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

Log out and back in after adding your user to the docker group.

## 3. Clone Project

```bash
cd /opt
sudo git clone <YOUR_REPO_URL> CIVISENCE
sudo chown -R $USER:$USER /opt/CIVISENCE
cd /opt/CIVISENCE
```

## 4. Configure Environment

Create centralized env file:

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Minimum required values:

- `MONGO_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AWS_REGION`
- `AWS_BUCKET_NAME`
- `CORS_ORIGIN` (your public URL)

Optional:

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (skip if using EC2 IAM role)
- `AI_MONITOR_API_KEY` (protect `/ai/*` monitoring endpoints)

## 5. Build and Run

```bash
docker compose -f docker-compose.ec2.yml up -d --build
```

Check:

```bash
docker compose -f docker-compose.ec2.yml ps
docker compose -f docker-compose.ec2.yml logs -f website
docker compose -f docker-compose.ec2.yml logs -f backend
docker compose -f docker-compose.ec2.yml logs -f ai_service
```

## 6. Health Checks

```bash
curl http://localhost/
curl http://localhost/api/health
curl http://localhost/ai/health
```

If `AI_MONITOR_API_KEY` is set:

```bash
curl -H "x-ai-monitor-key: <AI_MONITOR_API_KEY>" http://localhost/ai/health
```

## 7. Update Deployment

```bash
cd /opt/CIVISENCE
git pull
docker compose -f docker-compose.ec2.yml up -d --build
```

## 8. Stop / Restart

```bash
docker compose -f docker-compose.ec2.yml down
docker compose -f docker-compose.ec2.yml up -d
```

## 9. Optional HTTPS

Recommended production options:

- Put an AWS ALB in front and terminate TLS there, or
- Install host-level Nginx/Caddy with Let’s Encrypt and proxy to `website:80`.

## 10. Troubleshooting

- Port conflict on host:
  - `sudo lsof -i :80`
- Container crash loops:
  - `docker compose -f docker-compose.ec2.yml logs --tail=200 <service>`
- Rebuild from clean state:
  - `docker compose -f docker-compose.ec2.yml down`
  - `docker compose -f docker-compose.ec2.yml build --no-cache`
  - `docker compose -f docker-compose.ec2.yml up -d`
