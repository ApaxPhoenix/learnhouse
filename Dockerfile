# syntax=docker/dockerfile:1.7
#
# One Dockerfile for the whole monorepo.
#
#   target "learnhouse" (default) — FastAPI + Next.js web in ONE container,
#                                   run by supervisord. Only :3000 is public;
#                                   the web proxies /api/v1 and /content to the
#                                   API on 127.0.0.1:9000 inside the container.
#   target "payload"              — Payload CMS on :3001.
#
# Usually driven by docker-compose.yml:  pnpm docker:up

ARG NODE_VERSION=24.11.0
ARG PYTHON_VERSION=3.14.3
ARG PNPM_VERSION=11.27.1

# ── Node toolchain ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS node-base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /repo

# ── JS dependencies (cached until a manifest or the lockfile changes) ───────
FROM node-base AS js-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/payload/package.json apps/payload/
COPY apps/api/package.json apps/api/
# Filtered install: the Python app is skipped, so its `uv sync` postinstall
# never runs here — uv lives in the api-builder stage instead.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile \
      --filter "@learnhouse/web..." \
      --filter "@learnhouse/payload..."

# ── Build the web app ────────────────────────────────────────────────────────
FROM js-deps AS web-builder
COPY apps/web apps/web
ARG BUILD_ID=learnhouse-production
ENV NODE_ENV=production \
    BUILD_ID=${BUILD_ID}
# NEXT_PUBLIC_* values are NOT baked in here — server-wrapper.js writes them
# to runtime-config.json from the container's env at startup.
RUN pnpm --filter @learnhouse/web build

# ── Build Payload ────────────────────────────────────────────────────────────
FROM js-deps AS payload-builder
COPY apps/payload apps/payload
ENV NODE_ENV=production
RUN pnpm --filter @learnhouse/payload build

# ── Python dependencies ──────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim-bookworm AS api-builder
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*
# Same uv version as local dev (uv.lock revision 3).
COPY --from=ghcr.io/astral-sh/uv:0.11.25 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app/api
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project
COPY apps/api ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ── Runtime: API + web in one container ──────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim-bookworm AS learnhouse
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl supervisor \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 learnhouse \
 && useradd --system --uid 1001 --gid learnhouse --home /app learnhouse
# Next's standalone server only needs the node binary itself.
COPY --from=node-base /usr/local/bin/node /usr/local/bin/node

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PATH=/app/api/.venv/bin:$PATH \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    LEARNHOUSE_PORT=9000 \
    LEARNHOUSE_INTERNAL_BACKEND_URL=http://127.0.0.1:9000

WORKDIR /app
COPY --from=api-builder --chown=learnhouse:learnhouse /app/api /app/api
# Standalone output is traced from the workspace root, so the server lives
# at apps/web/server.js inside it.
COPY --from=web-builder --chown=learnhouse:learnhouse /repo/apps/web/.next/standalone /app/web
COPY --from=web-builder --chown=learnhouse:learnhouse /repo/apps/web/.next/static /app/web/apps/web/.next/static
COPY --from=web-builder --chown=learnhouse:learnhouse /repo/apps/web/public /app/web/apps/web/public
COPY --chown=learnhouse:learnhouse apps/web/server-wrapper.js /app/web/apps/web/server-wrapper.js
COPY docker/supervisord.conf /etc/supervisor/conf.d/learnhouse.conf
COPY docker/entrypoint.sh /usr/local/bin/learnhouse-entrypoint
# Strip CRLF in case the repo was checked out on Windows with autocrlf.
RUN sed -i 's/\r$//' /usr/local/bin/learnhouse-entrypoint /etc/supervisor/conf.d/learnhouse.conf \
 && chmod +x /usr/local/bin/learnhouse-entrypoint \
 && mkdir -p /app/api/content /app/api/logs \
 && chown -R learnhouse:learnhouse /app/api/content /app/api/logs

USER learnhouse
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:9000/api/v1/health >/dev/null \
   && curl -fsS http://127.0.0.1:3000/api/health >/dev/null || exit 1
ENTRYPOINT ["learnhouse-entrypoint"]

# ── Runtime: Payload CMS ─────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS payload
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3001 \
    NODE_OPTIONS=--no-deprecation
WORKDIR /app
COPY --from=payload-builder --chown=node:node /repo/apps/payload/.next/standalone ./
COPY --from=payload-builder --chown=node:node /repo/apps/payload/.next/static ./apps/payload/.next/static
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/questions?limit=1').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/payload/server.js"]
