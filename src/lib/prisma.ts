import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const LOG_LEVELS: ("query" | "error" | "warn" | "info")[] =
  process.env.NODE_ENV === "development"
    ? ["query", "error", "warn"]
    : ["error"];

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;

  // Production (Vercel): подключаемся к облачной базе Turso через libSQL-адаптер.
  if (tursoUrl) {
    const driver = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN ?? undefined
    });
    const adapter = new PrismaLibSQL(driver);
    return new PrismaClient({ adapter, log: LOG_LEVELS });
  }

  // Локальная разработка: файловый SQLite (как раньше, через DATABASE_URL).
  return new PrismaClient({ log: LOG_LEVELS });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;