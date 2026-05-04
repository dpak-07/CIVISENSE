#!/bin/sh
set -e

DOMAIN=${civisence.duckdns.org}
EMAIL=${EMAIL:-deepakofficial0103@gmial.com}

if [ ! -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then
  certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive || true
fi

exec "$@"

