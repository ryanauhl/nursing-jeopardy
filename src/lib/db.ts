import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 wants a driver adapter. The URL is resolved relative to the project
// root, which is where both `next` and the Prisma CLI run from.
const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

function createClient() {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
  });
}

// Reuse one client across dev-server hot reloads instead of leaking a
// connection on every rebuild.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
