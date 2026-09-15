/**
 * Локальный запуск Telegram-бота через long polling.
 *
 * Используется командой `npm run dev` (см. package.json):
 *   concurrently "next dev" "tsx watch scripts/dev.ts"
 *
 * В production тот же бот работает через webhook
 * (см. src/app/api/telegram/webhook/route.ts, B34).
 *
 * Режимы работы:
 *   --webhook-set <URL>   Установить webhook на указанный URL
 *   --webhook-info        Показать текущий статус webhook
 *   --webhook-delete      Удалить webhook (перед polling)
 *
 * Без флагов — long polling (для локальной разработки).
 */

import "dotenv/config";
import bot, { setupBotMenu } from "../src/bot/bot";

/* =========================================================================
 * Разбор аргументов командной строки
 * ========================================================================= */

const args = process.argv.slice(2);
const webhookSetIdx = args.indexOf("--webhook-set");
const setWebhookUrl =
  webhookSetIdx !== -1 ? args[webhookSetIdx + 1] : undefined;
const showInfo = args.includes("--webhook-info");
const deleteWebhook = args.includes("--webhook-delete");

/* =========================================================================
 * Утилита логирования
 * ========================================================================= */

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[bot ${ts}] ${msg}`);
}

/* =========================================================================
 * Режимы
 * ========================================================================= */

async function runWebhookInfo(): Promise<void> {
  const info = await bot.api.getWebhookInfo();
  console.log("📡 Webhook info:");
  console.log(JSON.stringify(info, null, 2));
}

async function runWebhookSet(url: string): Promise<void> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  await bot.api.setWebhook(url, {
    secret_token: secret,
    drop_pending_updates: true,
    allowed_updates: [
      "message",
      "callback_query",
      "edited_message"
    ]
  });
  log(`✅ Webhook установлен на ${url}`);
  if (!secret) {
    log(
      "⚠️  TELEGRAM_WEBHOOK_SECRET не задан — endpoint не защищён секретом"
    );
  }
}

async function runWebhookDelete(): Promise<void> {
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  log("✅ Webhook удалён");
}

/* =========================================================================
 * Long polling (dev-режим по умолчанию)
 * ========================================================================= */

async function runPolling(): Promise<void> {
  log("🚀 Запуск бота в режиме long polling (dev)...");

  // Убеждаемся, что webhook не установлен — иначе Telegram
  // не будет доставлять updates в getUpdates.
  try {
    const info = await bot.api.getWebhookInfo();
    if (info.url) {
      log(
        `⚠️  Обнаружен активный webhook (${info.url}). Удаляю перед polling...`
      );
      await bot.api.deleteWebhook({ drop_pending_updates: false });
    }
  } catch (err) {
    log(`⚠️  Не удалось проверить webhook: ${(err as Error).message}`);
  }

  // Настраиваем меню бота (одноразово при старте)
  await setupBotMenu();

  // Информация о боте
  const me = await bot.api.getMe();
  log(`🤖 Бот: @${me.username} (${me.first_name})`);

  // Плавная остановка по Ctrl+C
  const stop = async (signal: string) => {
    log(`⏹  Получен ${signal}, останавливаю бота...`);
    try {
      await bot.stop();
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", () => void stop("SIGINT"));
  process.once("SIGTERM", () => void stop("SIGTERM"));

  // bot.start() — блокирующий вызов: держит процесс до bot.stop()
  await bot.start({
    onStart: () => log("✅ Бот готов принимать сообщения"),
    drop_pending_updates: false
  });
}

/* =========================================================================
 * Точка входа
 * ========================================================================= */

async function main(): Promise<void> {
  try {
    if (showInfo) {
      await runWebhookInfo();
      return;
    }

    if (setWebhookUrl) {
      await runWebhookSet(setWebhookUrl);
      return;
    }

    if (deleteWebhook) {
      await runWebhookDelete();
      return;
    }

    await runPolling();
  } catch (err) {
    log(`❌ Фатальная ошибка: ${(err as Error).message}`);
    console.error(err);
    process.exit(1);
  }
}

main();