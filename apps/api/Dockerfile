FROM python:3.14.3-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends curl netcat-openbsd build-essential && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.10.7 /uv /uvx /bin/

ADD . /app

WORKDIR /app
RUN uv sync --frozen

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:9000/api/v1/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]