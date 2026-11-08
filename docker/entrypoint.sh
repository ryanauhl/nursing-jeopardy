#!/bin/sh
set -e

# Print which build this is. If you just rebuilt and this timestamp is old, the
# container is running a stale image — `docker-compose up -d --build`.
echo "→ image built at $(cat /app/BUILD_STAMP 2>/dev/null || echo 'unknown')"

MIGRATE=/app/migrate.mjs

if [ ! -r "$MIGRATE" ]; then
  echo "✗ cannot read $MIGRATE" >&2
  ls -l "$MIGRATE" >&2 2>/dev/null || echo "  (file is missing entirely)" >&2
  if [ -e /app/docker/migrate.mjs ]; then
    echo "  /app/docker/migrate.mjs exists — this is the OLD layout, so this" >&2
    echo "  image predates the fix. Rebuild: docker-compose up -d --build" >&2
  fi
  exit 1
fi

# Bring the database on the mounted volume up to the current schema. Safe to
# run on every boot: already-applied migrations are skipped, and a brand-new
# volume gets the full history. The games themselves are seeded by the app on
# first load when the library is empty (see ensureSeedGames).
echo "→ applying database migrations…"
node "$MIGRATE"

echo "→ starting Trivia Board on port ${PORT:-3737}"
exec "$@"
