#!/bin/sh
# Entrypoint for the "learnhouse" image (API + web under supervisord).
set -e

# Postgres (Neon) and Redis (Upstash) are managed services reached over TLS;
# the API retries its own connections, so there is nothing to wait for here.

if [ -z "${LEARNHOUSE_SQL_CONNECTION_STRING}" ]; then
  echo "LEARNHOUSE_SQL_CONNECTION_STRING is not set; check env_file in docker-compose.yml" >&2
  exit 1
fi

# The browser talks to the public URL; server-side code uses the internal one.
echo "API (internal):  ${LEARNHOUSE_INTERNAL_BACKEND_URL}"
echo "Web (public):    ${NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL:-<unset>}"
echo "Default org:     ${NEXT_PUBLIC_LEARNHOUSE_DEFAULT_ORG:-<unset>}"

exec supervisord -c /etc/supervisor/conf.d/learnhouse.conf
