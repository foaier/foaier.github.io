#!/bin/sh
# Local HTTP readiness, not a check of the whole application or database.
exec /usr/bin/curl -fsS --max-time 1 http://127.0.0.1/healthz >/dev/null
