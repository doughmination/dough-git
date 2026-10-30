# container/Dockerfile
# LICENCED DASL-1.0 (c) Clove Twilight

# The git agent: upload-pack, receive-pack, the viewer's reads and imports.
# Build context is the repo root (see wrangler.jsonc), so shared modules resolve.
FROM oven/bun:1-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates tar \
    && rm -rf /var/lib/apt/lists/*

COPY container ./container
COPY src/lib/server/gitref.ts src/lib/server/urls.ts ./src/lib/server/

ENV MINIGIT_REPOS_ROOT=/srv/git \
    GIT_AGENT_PORT=4011

EXPOSE 4011

CMD ["bun", "container/server.ts"]
