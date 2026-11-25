#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v openssl >/dev/null || { echo 'Please install openssl first.' >&2; exit 1; }
mkdir -p runtime certs
if [ ! -f runtime/default.conf ]; then cp lessons/01-start.conf runtime/default.conf; fi
if [ ! -f certs/localhost.crt ] || [ ! -f certs/localhost.key ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
    -keyout certs/localhost.key -out certs/localhost.crt \
    -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
  chmod 600 certs/localhost.key
fi
docker compose up -d
docker compose exec -T gateway nginx -t
echo "HTTP port: ${NGINX_HTTP_PORT:-8088}; HTTPS port: ${NGINX_HTTPS_PORT:-8443}. Existing lesson is preserved; first run uses lesson 01."
echo 'Use bash lesson.sh 04-proxy to switch lessons.'
