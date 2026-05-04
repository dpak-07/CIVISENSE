# CiviSense Deployment Guide (AWS EC2 - Amazon Linux 2023)

This guide deploys all 3 parts from this repo on one EC2 instance:

- `backend` (Node.js/Express, default `5000`)
- `ai_service` (FastAPI/Uvicorn, default `8000`)
- `frontend/CIVISENCE-WEBSITE` (Vite static build via Nginx)

## Step 1: Launch and Prepare EC2

1. Launch an EC2 instance with **Amazon Linux 2023**.
2. Attach an EBS volume with enough space (at least 20-30 GB recommended).
3. Security Group inbound rules:
- `22` (SSH) from your IP only.
- `80` (HTTP) from `0.0.0.0/0`.
- `443` (HTTPS) from `0.0.0.0/0`.
- Optional temporary debug: `5000`, `8000` from your IP only (remove after validation).
4. Connect to instance:

```bash
ssh -i /path/to/key.pem ec2-user@<EC2_PUBLIC_IP>
```

5. Update system:

```bash
sudo dnf update -y
sudo dnf install -y git nginx unzip curl gcc gcc-c++ make
```

## Step 2: Install Node.js 20, PM2, and Python 3.11

`backend/package.json` requires Node `>=20`.

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v
npm -v
sudo npm install -g pm2
pm2 -v
```

Install Python for `ai_service`:

```bash
sudo dnf install -y python3.11 python3.11-pip
python3.11 --version
```

## Step 3: Install and Start MongoDB 7

1. Configure MongoDB repo:

```bash
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo > /dev/null <<'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2023/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
```

2. Install and start:

```bash
sudo dnf install -y mongodb-org
sudo systemctl enable mongod
sudo systemctl start mongod
sudo systemctl status mongod --no-pager
```

3. Optional but recommended (replica set for Mongo change streams):
- Edit `/etc/mongod.conf` and add:

```yaml
replication:
  replSetName: rs0
```

- Then:

```bash
sudo systemctl restart mongod
mongosh --eval "rs.initiate()"
```

## Step 4: Clone Project

```bash 
sudo mkdir -p /var/www
sudo chown -R ec2-user:ec2-user /var/www
cd /var/www
git clone <YOUR_GIT_REPO_URL> CIVISENCE
cd CIVISENCE
```

## Step 5: Configure Backend (`/var/www/CIVISENCE/backend`)

1. Install dependencies:

```bash
cd /var/www/CIVISENCE/backend
npm ci --omit=dev
```

2. Create env file:

```bash
cp .env.example .env
nano .env
```

3. Set production values (minimum required by current code):

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/civisense
NODE_ENV=production
JWT_ACCESS_SECRET=<strong_secret>
JWT_REFRESH_SECRET=<strong_secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
AWS_REGION=<your-region>
AWS_ACCESS_KEY_ID=<your-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
AWS_BUCKET_NAME=<your-bucket-name>
```

Notes:
- In current backend code, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are mandatory.
- Push notifications are optional. If needed, add Firebase env vars from `backend/FCM_SETUP.md`.

## Step 6: Configure AI Service (`/var/www/CIVISENCE/ai_service`)

1. Create virtual environment and install packages:

```bash
cd /var/www/CIVISENCE/ai_service
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install --only-binary=:all: -r requirements.txt
deactivate
```

2. Configure env:

```bash
cp .env.example .env
nano .env
```

Minimum production values:

```env
APP_NAME=CiviSense AI Decision Engine
ENVIRONMENT=production
LOG_LEVEL=INFO
MONGO_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
MONGO_DB_NAME=civisense
MONGO_ALLOW_STANDALONE_FALLBACK=true
YOLO_MODEL_NAME=yolov8n.pt
CPU_THREADS=2
```

If you did not enable Mongo replica set, use:

```env
MONGO_URI=mongodb://127.0.0.1:27017/civisense
MONGO_ALLOW_STANDALONE_FALLBACK=true
```

## Step 7: Build Website (`/var/www/CIVISENCE/frontend/CIVISENCE-WEBSITE`)

1. Install dependencies:

```bash
cd /var/www/CIVISENCE/frontend/CIVISENCE-WEBSITE
npm ci
```

2. If instance is low memory, create swap temporarily:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
free -h
```

3. Build Vite app:

```bash
npm run build
```

4. Publish static files:

```bash
sudo mkdir -p /var/www/civisence-website
sudo cp -r dist/* /var/www/civisence-website/
```

5. Remove temporary swap (if created):

```bash
sudo swapoff /swapfile
sudo rm -f /swapfile
```

## Step 8: Start Backend and AI Service with PM2

1. Start backend:

```bash
pm2 start /var/www/CIVISENCE/backend/src/server.js --name civisense-backend --cwd /var/www/CIVISENCE/backend
```

2. Start AI service:

```bash
pm2 start /var/www/CIVISENCE/ai_service/.venv/bin/uvicorn --name civisense-ai --cwd /var/www/CIVISENCE/ai_service -- app.main:app --host 127.0.0.1 --port 8000
```

3. Persist PM2 services across reboot:

```bash
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user
```

Run the extra command printed by `pm2 startup` with `sudo`.

4. Quick checks:

```bash
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:8000/health
pm2 list
```

## Step 9: Configure Nginx Reverse Proxy

1. Create Nginx config file:

```bash
sudo nano /etc/nginx/conf.d/civisence.conf
```

2. Paste:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/civisence-website;
    index index.html;
    client_max_body_size 20M;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ai/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /health {
        proxy_pass http://127.0.0.1:5000/health;
    }
}
```

3. Validate and restart:

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
sudo systemctl status nginx --no-pager
```

## Step 10: Domain and DNS

1. Point your domain A record to EC2 public IP.
2. Wait for DNS propagation.
3. Verify:

```bash
curl -I http://your-domain.com
```

## Step 11: Enable HTTPS (Certbot)

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Verify auto-renew:

```bash
sudo certbot renew --dry-run
```

## Step 12: S3 and IAM (for Backend Uploads)

Backend uploads use AWS SDK and require these env vars:
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_BUCKET_NAME`

Recommended:

1. Create S3 bucket (private by default).
2. Create IAM policy with least-privilege S3 access to that bucket.
3. Create IAM user/access key for backend env vars (or adjust backend code to use instance role credentials).

## Step 13: Monitoring and Operations

Useful commands:

```bash
pm2 logs civisense-backend
pm2 logs civisense-ai
pm2 restart civisense-backend
pm2 restart civisense-ai
pm2 monit
sudo journalctl -u nginx -n 100 --no-pager
```

Health checks:

```bash
curl https://your-domain.com/health
curl https://your-domain.com/ai/health
```

## Step 14: Update / Redeploy

```bash
cd /var/www/CIVISENCE
git pull

cd backend
npm ci --omit=dev
pm2 restart civisense-backend

cd ../ai_service
source .venv/bin/activate
pip install --only-binary=:all: -r requirements.txt
deactivate
pm2 restart civisense-ai

cd ../frontend/CIVISENCE-WEBSITE
npm ci
npm run build
sudo cp -r dist/* /var/www/civisence-website/

sudo nginx -t
sudo systemctl reload nginx
```

## Quick Troubleshooting

- Backend not starting: check `backend/.env` and required variables.
- AI service not starting: check `.venv` and `ai_service/.env`.
- 502 from Nginx: verify PM2 process status and local ports (`5000`, `8000`).
- CORS error: set `CORS_ORIGIN` in backend `.env` to your actual frontend URL.
- Build out-of-memory: use temporary swap before `npm run build`.
