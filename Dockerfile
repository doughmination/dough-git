# syntax=docker/dockerfile:1

# The SvelteKit UI is built once; serve.ts then runs it on Bun.serve, with git
# transport streaming through the same server. git is needed for
# upload-pack / receive-pack, the viewer, and imports.
FROM oven/bun:1-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=build /app/build ./build
COPY serve.ts ./
COPY src/lib/server ./src/lib/server
COPY src/lib/index.ts ./src/lib/index.ts

# Sensible in-container defaults; secrets come from the environment / .env.
ENV MINIGIT_HOST=0.0.0.0 \
    MINIGIT_PORT=4010 \
    MINIGIT_REPOS_ROOT=/srv/git

EXPOSE 4010
VOLUME ["/srv/git"]

CMD ["bun", "serve.ts"]
