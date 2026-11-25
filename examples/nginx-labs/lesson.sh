#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
lesson="${1:-}"
case "$lesson" in
  01-start|02-config|03-location|04-proxy|05-balance|06-static|07-https|08-cache|09-security|10-debug|12-project) ;;
  *) echo 'Use a lesson filename without .conf, for example: bash lesson.sh 04-proxy' >&2; exit 1 ;;
esac
test -f runtime/default.conf || { echo 'Run bash init.sh first.' >&2; exit 1; }
cp runtime/default.conf runtime/previous.conf.bak
cp "lessons/$lesson.conf" runtime/default.conf
if docker compose exec -T gateway nginx -t && docker compose exec -T gateway nginx -s reload; then
  echo "Loaded $lesson. Verify with the curl command from this lesson."
else
  cp runtime/previous.conf.bak runtime/default.conf
  docker compose exec -T gateway nginx -t && docker compose exec -T gateway nginx -s reload
  echo 'The new configuration failed; the previous file was restored.' >&2
  exit 1
fi
