import { Bot, session } from "grammy";
import { prisma } from "@/lib/prisma";
import {
  initialSession,
  resetSessionData,
  type BotContext,
  type BotSessionData
} from "./session";

// Сцены — экраны + обработчики
import {
  showSelectHall,
  handleHallSelected
} from "./scenes/selectHall";
import {
  showSelectService,
  handleServiceSelected,
  handleBackToHalls
} from "./scenes/selectService";
import {
  showSelectDate,
  handleDateSelected,
  handleCalendarNavigation,
  handleBackToServices
} from "./scenes/selectDate";
import {
  showSelectTime,
  handleTimeSelected,
  handleBackToDates
} from "./scenes/selectTime";
import {
  showEnterContact,
  handleNameInput,
  handlePhoneInput,
  handleContactShared,
  handleBackToTimes,
  handleBackToName
} from "./scenes/enterContact";
import {
  showConfirm,
  handleConfirm,
  handleCancelConfirm
} from "./scenes/confirmBooking";

/* =========================================================================
 * Проверка окружения
 * ========================================================================= */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error(
    "TELEGRAM_BOT_TOKEN не задан в .env — бот не может запуститься"
  );
}

/* =========================================================================
 * Создание бота + middleware
 * ========================================================================= */

export const bot = new Bot<BotContext>(BOT_TOKEN);

// In-memory сессии по chatId (для MVP — см. SPEC раздел 7)
bot.use(
  session<BotSessionData, BotContext>({
    initial: initialSession,
    getSessionKey: (ctx) =>
      ctx.chat?.id !== undefined ? String(ctx.chat.id) : undefined
  })
);

// Глобальный перехватчик ошибок — чтобы падение одного handler'а
// не убивало polling/webhook.
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(
    `[bot] Error while handling update ${ctx.update.update_id}:`
  );
  console.error(err.error);
});

/* =========================================================================
 * Команды
 * ========================================================================= */

bot.command("start", async (ctx) => {
  await showSelectHall(ctx);
});

bot.command("cancel", async (ctx) => {
  ctx.session = resetSessionData(ctx.session);
  await ctx.reply(
    "✖️ Диалог сброшен.\n\nЧтобы начать заново, отправьте /start.",
    { reply_markup: { remove_keyboard: true } }
  );
});

bot.command("my_bookings", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const telegramId = String(chatId);

  // Ищем клиента по telegramId; если не найден — по номеру,
  // который пользователь оставлял в брони (пока не поддерживаем).
  const client = await prisma.client.findUnique({
    where: { telegramId },
    include: {
      bookings: {
        where: {
          date: { gte: startOfTodayUtc() },
          status: { in: ["PENDING", "CONFIRMED"] }
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        include: {
          hall: { select: { name: true } },
          service: { select: { name: true } }
        }
      }
    }
  });

  if (!client) {
    await ctx.reply(
      "У вас пока нет бронирований в Vibe Studio.\n\n" +
        "Отправьте /start, чтобы забронировать студию."
    );
    return;
  }

  if (client.bookings.length === 0) {
    await ctx.reply(
      "У вас нет предстоящих бронирований.\n\n" +
        "Отправьте /start, чтобы создать новое."
    );
    return;
  }

  const lines: string[] = ["📋 *Ваши предстоящие брони:*", ""];

  for (const b of client.bookings) {
    const dateStr = b.date.toISOString().slice(0, 10);
    lines.push(
      `🏛 *${escapeMarkdown(b.hall.name)}* — ${escapeMarkdown(
        b.service.name
      )}\n` +
        `🗓 ${formatDateRu(dateStr)} · ${b.startTime} — ${b.endTime}\n` +
        `💰 ${new Intl.NumberFormat("ru-RU").format(
          Number(b.totalPrice)
        )} сум\n`
    );
  }

  await ctx.reply(lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: { remove_keyboard: true }
  });
});

/* =========================================================================
 * Callback-роутер (inline-кнопки)
 * ========================================================================= */

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;

  // noop — заглушка для неактивных ячеек календаря/навигации
  if (data === "cal:noop") {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    // Перебираем все сцены — первая, которая «узнала» callback,
    // возвращает true и прерывает цепочку.
    if (await handleHallSelected(ctx, data)) return;
    if (await handleServiceSelected(ctx, data)) return;
    if (await handleDateSelected(ctx, data)) return;
    if (await handleCalendarNavigation(ctx, data)) return;
    if (await handleTimeSelected(ctx, data)) return;

    // Навигация «назад»
    if (await handleBackToHalls(ctx, data)) return;
    if (await handleBackToServices(ctx, data)) return;
    if (await handleBackToDates(ctx, data)) return;
    if (await handleBackToTimes(ctx, data)) return;
    if (await handleBackToName(ctx, data)) return;

    // Финальный экран
    if (await handleConfirm(ctx, data)) return;
    if (await handleCancelConfirm(ctx, data)) return;

    // Ни одна сцена не узнала callback — отвечаем тихо, без изменений
    await ctx.answerCallbackQuery();
  } catch (err) {
    console.error("[bot] callback handler error", err);
    try {
      await ctx.answerCallbackQuery({
        text: "Произошла ошибка. Попробуйте ещё раз.",
        show_alert: true
      });
    } catch {
      // Уже ответили — не страшно
    }
  }
});

/* =========================================================================
 * Текстовые сообщения (свободный ввод: имя, телефон)
 * ========================================================================= */

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;

  // Игнорируем команды — они уже обработаны выше
  if (text.startsWith("/")) return;

  try {
    if (await handleNameInput(ctx, text)) return;
    if (await handlePhoneInput(ctx, text)) return;

    // Пользователь написал что-то вне сценария — вежливая подсказка
    if (ctx.session.step === "idle") {
      await ctx.reply(
        "Чтобы забронировать студию, отправьте /start.\n" +
          "Посмотреть свои брони — /my_bookings."
      );
    }
  } catch (err) {
    console.error("[bot] text handler error", err);
    await ctx.reply("⚠️ Что-то пошло не так. Попробуйте ещё раз.");
  }
});

/* =========================================================================
 * Контакт (reply-кнопка «Отправить контакт»)
 * ========================================================================= */

bot.on("message:contact", async (ctx) => {
  const phone = ctx.message.contact.phone_number;
  try {
    if (await handleContactShared(ctx, phone)) return;
  } catch (err) {
    console.error("[bot] contact handler error", err);
    await ctx.reply("⚠️ Не удалось принять контакт. Введите номер текстом.");
  }
});

/* =========================================================================
 * Fallback: другие типы сообщений
 * ========================================================================= */

bot.on("message", async (ctx) => {
  await ctx.reply(
    "Пожалуйста, используйте текст или кнопки ниже. " +
      "Начать заново — /start."
  );
});

/* =========================================================================
 * Утилиты
 * ========================================================================= */

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

function formatDateRu(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[])/g, "\\$1");
}

/* =========================================================================
 * Настройка меню команд (одноразово при импорте модуля)
 * ========================================================================= */

export async function setupBotCommands(): Promise<void> {
  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Забронировать студию" },
      { command: "my_bookings", description: "Мои брони" },
      { command: "cancel", description: "Отменить текущий диалог" }
    ]);
  } catch (err) {
    console.warn("[bot] setMyCommands failed", err);
  }
}

export default bot;