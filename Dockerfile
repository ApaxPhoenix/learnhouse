# Build Frontend using Bun
FROM oven/bun:1-alpine AS frontend-builder
WORKDIR /app
# Copy only the files needed for dependency installation
COPY apps/web/package.json apps/web/bun.lock* ./apps/web/
WORKDIR /app/apps/web
RUN bun install --frozen-lockfile

# Copy the rest of the frontend source code and compile
WORKDIR /app
COPY apps/web/ ./apps/web/
WORKDIR /app/apps/web
RUN bun run build

# Final Runtime Environmenl
FROM python:3.14.3-slim-bookworm

# Install curl, netcat, build tools, supervisor, and Node.js 18
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    netcat-openbsd \
    build-essential \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy uv binaries from the official image
COPY --from=ghcr.io/astral-sh/uv:0.10.7 /uv /uvx /bin/

WORKDIR /app

# Remove Enterprise Edition folder if public build configuration flag is set
ARG LEARNHOUSE_PUBLIC=false
ADD . /app
RUN if [ "$LEARNHOUSE_PUBLIC" = "true" ]; then rm -rf /app/ee; fi

# Sync the Python backend project using the frozen lockfile
WORKDIR /app/apps/api
RUN uv sync --frozen
COPY apps/api/ .

# Prepare the Next.js standalone directory assets
WORKDIR /app/apps/web
COPY --from=frontend-builder /app/apps/web/.next/standalone ./
COPY --from=frontend-builder /app/apps/web/.next/static ./.next/static
COPY --from=frontend-builder /app/apps/web/public ./public
COPY --from=frontend-builder /app/apps/web/server-wrapper.js ./

# Create runtime tracking files matching your original configuration specifications
RUN touch /app/apps/web/runtime-config.json

# Copy orchestrator files to the application root directory
WORKDIR /app
COPY docker-entrypoint.sh ./
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod +x docker-entrypoint.sh

# Expose Next.js public binding port
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]