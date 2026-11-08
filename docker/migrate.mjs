// Applies Prisma migrations at container start.
//
// Why not `prisma migrate deploy`? The Prisma CLI pulls ~290MB of transitive
// dependencies into the runtime image purely to run this one command. The
// migrations themselves are plain SQL files, and better-sqlite3 is already in
// the standalone bundle, so applying them directly keeps the image small and
// the runtime dependency surface tiny.
//
// The `_prisma_migrations` bookkeeping written here is byte-compatible with
// the real CLI (verified against a CLI-migrated database): the table DDL
// matches, and `checksum` is the sha256 of the migration.sql bytes. You can
// still run `npx prisma migrate status|dev` against this database from the
// host and it will agree.

import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const url = process.env.DATABASE_URL ?? "file:/data/jeopardy.db";
const dbPath = url.replace(/^file:/, "");
const migrationsDir = join(process.cwd(), "prisma", "migrations");

const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.exec(MIGRATIONS_TABLE);

const applied = new Map(
  db
    .prepare("SELECT migration_name, checksum FROM _prisma_migrations WHERE rolled_back_at IS NULL")
    .all()
    .map((row) => [row.migration_name, row.checksum]),
);

// Prisma migration directories are timestamp-prefixed, so lexical order is
// chronological order.
const pending = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const record = db.prepare(
  `INSERT INTO _prisma_migrations
     (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
   VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
);

let count = 0;
for (const name of pending) {
  const sql = readFileSync(join(migrationsDir, name, "migration.sql"));
  const checksum = createHash("sha256").update(sql).digest("hex");

  const previous = applied.get(name);
  if (previous !== undefined) {
    if (previous !== checksum) {
      console.error(
        `✗ migration "${name}" was modified after it was applied ` +
          `(recorded ${previous}, found ${checksum}). Refusing to continue.`,
      );
      process.exit(1);
    }
    continue;
  }

  const startedAt = Date.now();
  // One transaction per migration: a failure leaves no half-applied schema and
  // no bookkeeping row, so the next boot retries cleanly.
  db.transaction(() => {
    db.exec(sql.toString("utf8"));
    record.run(randomUUID(), checksum, Date.now(), name, startedAt);
  })();

  console.log(`  applied ${name}`);
  count += 1;
}

db.close();
console.log(
  count === 0 ? "  database already up to date" : `  ${count} migration(s) applied`,
);
