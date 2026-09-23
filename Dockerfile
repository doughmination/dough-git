# syntax=docker/dockerfile:1

# Bun runs the TypeScript sources directly, so there is no build stage.
# git is needed for upload-pack / receive-pack, the viewer, and imports.
FROM oven/bun:1-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY public ./public

# Sensible in-container defaults; secrets come from the environment / .env.
ENV MINIGIT_HOST=0.0.0.0 \
    MINIGIT_PORT=4010 \
    MINIGIT_REPOS_ROOT=/srv/git \
    MINIGIT_STATIC_DIR=/app/public

EXPOSE 4010
VOLUME ["/srv/git"]

CMD ["bun", "src/server.ts"]
