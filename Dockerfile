# syntax=docker/dockerfile:1

# Debian slim rather than Alpine: better-sqlite3 ships glibc prebuilds, so the
# native addon installs without dragging a full toolchain into the build.
ARG NODE_VERSION=22-bookworm-slim

# ---------------------------------------------------------------------------
# deps — install once, reuse in the build
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# node-gyp fallback, in case a prebuilt better-sqlite3 binary isn't published
# for this platform.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# npm blocks install scripts by default here; better-sqlite3 and the Prisma
# engines need theirs to run, and `allowScripts` in package.json approves them.
RUN npm ci

# ---------------------------------------------------------------------------
# builder — generate the Prisma client and compile the Next.js app
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Normalise permissions on everything from the build context. COPY preserves
# the host's file modes and git records only the executable bit, so a checkout
# under a restrictive umask (e.g. 077) yields 0600 files. Those stay 0600 all
# the way into the runtime image, where the unprivileged `node` user then can't
# read them. Doing it here fixes every file at once — the migration runner, the
# .sql files, all of it — and costs nothing in the final image because builder
# layers aren't shipped.
RUN chmod -R a+rX /app

# The client is generated into src/generated/prisma, which is gitignored.
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
# A DATABASE_URL has to be present for the build; nothing connects to it.
ENV DATABASE_URL="file:/tmp/build.db"
RUN npm run build

# ---------------------------------------------------------------------------
# runner — the shipped image
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3737
ENV HOSTNAME=0.0.0.0
# The database lives on a volume so games survive `docker compose down`.
ENV DATABASE_URL="file:/data/jeopardy.db"

# The standalone bundle carries its own traced node_modules, including the
# better-sqlite3 native addon that the migration runner reuses. /app stays
# root-owned and read-only at runtime — only /data is written to.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Migration history, applied at startup by migrate.mjs. The Prisma CLI is
# deliberately not installed here: it would add ~290MB of transitive
# dependencies to run one command against plain .sql files.
COPY --from=builder /app/prisma/migrations ./prisma/migrations

# Taken from the builder, where permissions were already normalised, rather
# than from the build context — so the host's umask can't reach the runtime
# image. It lands directly in /app, not /app/docker/: COPY applies --chmod to
# parent directories it creates too, and 0644 on a directory has no execute
# bit, which makes it impossible to traverse.
COPY --from=builder --chmod=644 /app/docker/migrate.mjs ./migrate.mjs

# Stamped at build time so a stale image is obvious in the logs: the entrypoint
# prints this on every boot. If it doesn't match when you rebuilt, the
# container is running an old image.
RUN date -u +'%Y-%m-%dT%H:%M:%SZ' > /app/BUILD_STAMP

COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
# Only the data volume needs to be writable by the runtime user. Avoid a
# recursive chown over /app — it would rewrite every file into a second copy.
RUN mkdir -p /data && chown node:node /data

USER node
VOLUME ["/data"]
EXPOSE 3737

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3737)+'/api/games').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
