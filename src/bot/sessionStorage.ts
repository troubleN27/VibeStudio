import { createClient, type Client } from "@libsql/client";
import type { StorageAdapter } from "grammy";
import type { BotSessionData } from "./session";

/**
 * Хранилище сессий бота в Turso (та же продовая база).
 *
 * In-memory сессии грамми живут в одном процессе и на serverless (Vercel)
 * теряются между инстансами — multi-step диалог при этом «забывает» шаг.
 * Этот адаптер хранит сессию в таблице BotSession, так что бот работает
 * надёжно в production, независимо от того, какой lambda-инстанс обработал
 * update.
 */

const TABLE = "BotSession";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней

async function initializeTable(client: Client): Promise<void> {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS ${TABLE} (
       key       TEXT PRIMARY KEY,
       value     TEXT NOT NULL,
       updatedAt INTEGER NOT NULL
     )`
  );
}

export function createBotSessionStorage(): StorageAdapter<BotSessionData> {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN ?? undefined
  });

  // Идемпотентно создаём таблицу при каждом холодном старте.
  void initializeTable(client).catch((err) => {
    console.error("[bot] BotSession table init failed", err);
  });

  return {
    async read(key) {
      const res = await client.execute({
        sql: `SELECT value FROM ${TABLE}
              WHERE key = ? AND updatedAt > ?`,
        args: [key, Date.now() - SESSION_TTL_MS]
      });
      const row = res.rows[0];
      if (!row) return undefined;
      try {
        return JSON.parse(row.value as string) as BotSessionData;
      } catch {
        return undefined;
      }
    },

    async write(key, value) {
      const json = JSON.stringify(value);
      await client.execute({
        sql: `INSERT INTO ${TABLE} (key, value, updatedAt)
              VALUES (?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updatedAt = excluded.updatedAt`,
        args: [key, json, Date.now()]
      });
    },

    async delete(key) {
      await client.execute({
        sql: `DELETE FROM ${TABLE} WHERE key = ?`,
        args: [key]
      });
    }
  };
}