import { NextRequest, NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import bot from "@/bot/bot";

/**
 * POST /api/telegram/webhook
 *
 * Принимает обновления Telegram и передаёт их в Grammy.
 * Используется в production (в dev-режиме бот работает через long polling —
 * см. scripts/dev.ts).
 *
 * Telegram требует быстрый ответ 200 OK. Grammy-webhookCallback
 * возвращает Response с нужным статусом. Если handler упадёт,
 * Telegram повторит запрос — bot.catch() в bot.ts это обработает.
 */

// Grammy ожидает Node-совместимый Request. В Next.js 14 App Router
// req имеет тип NextRequest (расширение Request) — совместимо.
const handleUpdate = webhookCallback(bot, "std/http", {
  timeoutMilliseconds: 10_000,
  onTimeout: "return"
});

/* =========================================================================
 * Проверка секретного токена (опционально, но рекомендуется)
 *
 * Telegram поддерживает secret_token при setWebhook — в каждом запросе
 * приходит заголовок X-Telegram-Bot-Api-Secret-Token. Если переменная
 * TELEGRAM_WEBHOOK_SECRET задана, проверяем его совпадение.
 * ========================================================================= */

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  try {
    // Проверка secret token, если он настроен
    if (WEBHOOK_SECRET) {
      const headerSecret = req.headers.get(
        "x-telegram-bot-api-secret-token"
      );
      if (headerSecret !== WEBHOOK_SECRET) {
        return NextResponse.json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "Invalid webhook secret"
            }
          },
          { status: 401 }
        );
      }
    }

    // Передаём управление Grammy
    return await handleUpdate(req);
  } catch (err) {
    console.error("[POST /api/telegram/webhook]", err);
    // Telegram ретраит при 5xx — вернём 200, чтобы не зацикливаться
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

/**
 * GET — простая проверка, что endpoint жив (для мониторинга).
 * Ничего не раскрывает о боте.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}