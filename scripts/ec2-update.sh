#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/var/www/CIVISENSE}"
WEBSITE_ROOT="${WEBSITE_ROOT:-/var/www/civisense-website}"
PUBLIC_HOST="${PUBLIC_HOST:-3.7.203.235}"
DOMAIN="${DOMAIN:-}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-${APP_ROOT}/.env.backend.production}"
AI_ENV_FILE="${AI_ENV_FILE:-${APP_ROOT}/.env.ai.production}"
WEBSITE_ENV_FILE="${WEBSITE_ENV_FILE:-${APP_ROOT}/.env.website.production}"

PUBLIC_ORIGIN="http://${PUBLIC_HOST}"
PUBLIC_API_URL="http://${PUBLIC_HOST}/api"
if [[ -n "${DOMAIN}" ]]; then
  PUBLIC_ORIGIN="https://${DOMAIN}"
  PUBLIC_API_URL="https://${DOMAIN}/api"
fi

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

ensure_env_files() {
  local missing=0
  for env_file in "${BACKEND_ENV_FILE}" "${AI_ENV_FILE}" "${WEBSITE_ENV_FILE}"; do
    if [[ ! -f "${env_file}" ]]; then
      log "Missing ${env_file}"
      missing=1
    fi
  done
  if [[ "${missing}" == "1" ]]; then
    log "Create the root env files manually before updating."
    exit 1
  fi
}

pull_latest_code() {
  if [[ "${SKIP_GIT_PULL}" == "1" ]]; then
    log "Skipping git pull"
    return
  fi

  log "Pulling latest code"
  cd "${APP_ROOT}"
  git pull --ff-only
}

redeploy_backend() {
  log "Redeploying backend"
  cd "${APP_ROOT}/backend"
  npm ci --omit=dev
  pm2 describe civisense-backend >/dev/null 2>&1 \
    && pm2 restart civisense-backend --update-env \
    || pm2 start bash --name civisense-backend --cwd "${APP_ROOT}/backend" -- -lc "set -a; . '${BACKEND_ENV_FILE}'; set +a; exec node src/server.js"
}

redeploy_ai_service() {
  log "Redeploying AI service"
  cd "${APP_ROOT}/ai_service"
  if [[ ! -d .venv ]]; then
    python3.11 -m venv .venv
  fi
  . .venv/bin/activate
  python -m pip install --upgrade pip
  pip install --only-binary=:all: -r requirements.txt
  deactivate
  pm2 describe civisense-ai >/dev/null 2>&1 \
    && pm2 restart civisense-ai --update-env \
    || pm2 start bash --name civisense-ai --cwd "${APP_ROOT}/ai_service" -- -lc "set -a; . '${AI_ENV_FILE}'; set +a; exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
}

redeploy_frontend() {
  log "Redeploying frontend"
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
  sudo nginx -t
  sudo systemctl reload nginx
}

health_checks() {
  log "Running health checks"
  sleep 8
  curl -fsS http://127.0.0.1:5000/health || true
  printf '\n'
  curl -fsS http://127.0.0.1:8000/health || true
  printf '\n'
  pm2 list
}

main() {
  if [[ ! -d "${APP_ROOT}" ]]; then
    log "APP_ROOT not found: ${APP_ROOT}"
    exit 1
  fi

  pull_latest_code
  ensure_env_files
  redeploy_backend
  redeploy_ai_service
  redeploy_frontend
  pm2 save
  health_checks
  log "Update complete. Public API URL: ${PUBLIC_API_URL}"
}

main "$@"
