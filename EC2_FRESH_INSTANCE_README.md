# Fresh EC2 Instance Setup for CiviSense Docker

Use this after opening a new EC2 instance for production.

## 1. Connect to EC2

From your local machine:

```bash
ssh -i /path/to/your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

## 2. Install Docker and Git

On the EC2 instance:

```bash
## Ubuntu EC2 (apt-based):
sudo apt update
sudo apt install -y docker.io docker-compose git curl
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
newgrp docker
docker compose version

## Amazon Linux (dnf-based):
sudo dnf update -y
sudo dnf install -y docker git docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
newgrp docker
docker compose version
```

If `docker compose version` works, Docker is ready.

## 3. Get the Project

Clone your repository:

```bash
git clone <YOUR_GIT_REPO_URL> CIVISENSE
cd CIVISENSE
```

If you copied the project manually instead of cloning, just `cd` into the project folder.

## 4. Create Production Environment File

```bash
cp .env.docker.example .env
nano .env
```

Fill these required values:

```env
JWT_ACCESS_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>
CORS_ORIGIN=http://<EC2_PUBLIC_IP>
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<your-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
AWS_BUCKET_NAME=<your-s3-bucket-name>
```

If you already have a domain, use it instead:

```env
CORS_ORIGIN=https://your-domain.com
```

## 5. Open EC2 Security Group Ports

In AWS EC2 Security Group inbound rules, allow:

- `22` from your IP only
- `80` from `0.0.0.0/0`
- `443` from `0.0.0.0/0` if using HTTPS

Do not expose MongoDB, backend port `5000`, or AI port `8000` publicly. Docker keeps them private.

## 6. Start the App

```bash
docker compose up -d --build
```

First startup can take several minutes because the AI service downloads model files.

Check containers:

```bash
docker compose ps
```

Watch logs:

```bash
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f ai-service
```

## 7. Test the Deployment

On the EC2 instance:

```bash
curl http://localhost/health
curl http://localhost/ai/health
```

From your browser:

```text
http://<EC2_PUBLIC_IP>
```

## 8. Seed Data If Needed

Run these only after containers are healthy:

```bash
docker compose run --rm -v "$PWD/database:/database:ro" backend npm run seed:developers
docker compose run --rm -v "$PWD/database:/database:ro" backend npm run seed:complaints
docker compose run --rm -v "$PWD/database:/database:ro" backend npm run seed:users
```

## 9. Update Later

```bash
cd CIVISENSE
git pull
docker compose up -d --build
docker image prune -f
```

## Useful Commands

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f ai-service
docker compose restart backend
docker compose restart ai-service
docker compose down
```

Important: do not run `docker compose down -v` in production unless you want to delete MongoDB data.

## HTTPS Later

For production HTTPS, put one of these in front of the Docker stack:

- AWS Application Load Balancer with an ACM certificate
- CloudFront with an ACM certificate
- Caddy or host Nginx on the EC2 instance

Forward public traffic to EC2 port `80`.
