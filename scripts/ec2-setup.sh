#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/var/www/CIVISENSE}"
WEBSITE_ROOT="${WEBSITE_ROOT:-/var/www/civisense-website}"
PUBLIC_HOST="${PUBLIC_HOST:-13.200.19.117}"
DOMAIN="${DOMAIN:-}"
REPO_URL="${CIVISENSE_REPO_URL:-}"
APP_USER="${APP_USER:-ec2-user}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-${APP_ROOT}/.env.backend.production}"
AI_ENV_FILE="${AI_ENV_FILE:-${APP_ROOT}/.env.ai.production}"
WEBSITE_ENV_FILE="${WEBSITE_ENV_FILE:-${APP_ROOT}/.env.website.production}"

SERVER_NAME="_"
PUBLIC_ORIGIN="http://${PUBLIC_HOST}"
PUBLIC_API_URL="http://${PUBLIC_HOST}/api"
if [[ -n "${DOMAIN}" ]]; then
  SERVER_NAME="${DOMAIN}"
  PUBLIC_ORIGIN="https://${DOMAIN}"
  PUBLIC_API_URL="https://${DOMAIN}/api"
fi

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_amazon_linux() {
  if [[ ! -f /etc/os-release ]] || ! grep -q 'Amazon Linux' /etc/os-release; then
    log "This script is intended for Amazon Linux 2023. Continuing anyway."
  fi
}

prepare_source_tree() {
  log "Preparing application folder at ${APP_ROOT}"
  sudo mkdir -p "$(dirname "${APP_ROOT}")" "${WEBSITE_ROOT}"
  sudo chown -R "${APP_USER}:${APP_USER}" "$(dirname "${APP_ROOT}")" "${WEBSITE_ROOT}"

  if [[ ! -d "${APP_ROOT}/.git" ]]; then
    if [[ -n "${REPO_URL}" ]]; then
      git clone "${REPO_URL}" "${APP_ROOT}"
    else
      log "APP_ROOT does not contain a git repo and CIVISENSE_REPO_URL is not set."
      log "Clone your repo to ${APP_ROOT}, or run with CIVISENSE_REPO_URL=https://github.com/owner/repo.git"
      exit 1
    fi
  else
    git -C "${APP_ROOT}" pull --ff-only
  fi
}

install_system_packages() {
  log "Installing OS packages"
  sudo dnf update -y
  sudo dnf install -y git nginx unzip curl gcc gcc-c++ make tar gzip python3.11 python3.11-pip

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 20 ]]; then
    log "Installing Node.js 20"
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs
  fi

  log "Installing PM2"
  sudo npm install -g pm2
}

install_mongodb() {
  log "Installing and configuring MongoDB 7"
  sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo >/dev/null <<'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2023/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
  sudo dnf install -y mongodb-org

  if ! sudo grep -q 'replSetName: rs0' /etc/mongod.conf; then
    sudo tee -a /etc/mongod.conf >/dev/null <<'EOF'

replication:
  replSetName: rs0
EOF
  fi

  sudo systemctl enable mongod
  sudo systemctl restart mongod
  sleep 5
  mongosh --quiet --eval 'try { rs.status().ok } catch (e) { rs.initiate({_id:"rs0", members:[{_id:0, host:"127.0.0.1:27017"}]}) }' || true
}

check_root_env_files() {
  log "Checking root production env files"
  local missing=0
  for env_file in "${BACKEND_ENV_FILE}" "${AI_ENV_FILE}" "${WEBSITE_ENV_FILE}"; do
    if [[ ! -f "${env_file}" ]]; then
      log "Missing ${env_file}"
      missing=1
    fi
  done

  if [[ "${missing}" == "1" ]]; then
    cat <<EOF

Create these root env files manually, then rerun this script or run scripts/ec2-update.sh:

  ${BACKEND_ENV_FILE}
  ${AI_ENV_FILE}
  ${WEBSITE_ENV_FILE}

No app-local .env files are created by this script.
EOF
    return 1
  fi
}

install_backend() {
  log "Installing backend dependencies"
  cd "${APP_ROOT}/backend"
  npm ci --omit=dev
}

install_ai_service() {
  log "Installing AI service dependencies"
  cd "${APP_ROOT}/ai_service"
  python3.11 -m venv .venv
  . .venv/bin/activate
  python -m pip install --upgrade pip
  pip install --only-binary=:all: -r requirements.txt
  deactivate
}

build_frontend() {
  log "Building and publishing website"
  cd "${APP_ROOT}/frontend/CIVISENCE-WEBSITE"
  npm ci
  set -a
  # shellcheck disable=SC1090
  . "${WEBSITE_ENV_FILE}"
  set +a
  npm run build
  sudo mkdir -p "${WEBSITE_ROOT}"
  sudo rm -rf "${WEBSITE_ROOT:?}/"*
  sudo cp -r dist/* "${WEBSITE_ROOT}/"
  sudo chown -R nginx:nginx "${WEBSITE_ROOT}" || true
}

configure_nginx() {
  log "Writing Nginx reverse proxy config"
  sudo tee /etc/nginx/conf.d/civisense.conf >/dev/null <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${WEBSITE_ROOT};
    index index.html;
    client_max_body_size 20M;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /ai/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /health {
        proxy_pass http://127.0.0.1:5000/health;
    }
}
EOF
  sudo nginx -t
  sudo systemctl enable nginx
  sudo systemctl restart nginx
}

start_pm2_services() {
  log "Starting backend and AI service with PM2"
  pm2 describe civisense-backend >/dev/null 2>&1 \
    && pm2 restart civisense-backend --update-env \
    || pm2 start bash --name civisense-backend --cwd "${APP_ROOT}/backend" -- -lc "set -a; . '${BACKEND_ENV_FILE}'; set +a; exec node src/server.js"

  pm2 describe civisense-ai >/dev/null 2>&1 \
    && pm2 restart civisense-ai --update-env \
    || pm2 start bash --name civisense-ai --cwd "${APP_ROOT}/ai_service" -- -lc "set -a; . '${AI_ENV_FILE}'; set +a; exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

  pm2 save
  sudo env PATH="$PATH" pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" >/dev/null || true
}

health_checks() {
  log "Running health checks"
  sleep 8
  curl -fsS http://127.0.0.1:5000/health || true
  printf '\n'
  curl -fsS http://127.0.0.1:8000/health || true
  printf '\n'
  curl -I "http://${PUBLIC_HOST}" || true
}

main() {
  require_amazon_linux
  prepare_source_tree
  install_system_packages
  install_mongodb
  install_backend
  install_ai_service
  if ! check_root_env_files; then
    log "System packages, MongoDB, backend deps, and AI deps are ready."
    log "Place the root env files, then run scripts/ec2-update.sh to build the website and start PM2 services."
    exit 0
  fi
  build_frontend
  configure_nginx
  start_pm2_services
  health_checks
  log "Setup complete. Public site: ${PUBLIC_ORIGIN}"
}

main "$@"
