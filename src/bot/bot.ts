import { Bot, InlineKeyboard, session } from "grammy";
import { prisma } from "@/lib/prisma";
import { formatDateRu, startOfTodayUtc } from "@/lib/dates";
import { escapeMarkdown, formatPrice } from "@/lib/format";
import { MINI_APP_URL } from "./constants";
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

bot.command("app", async (ctx) => {
  await ctx.reply(
    "📱 *Онлайн-бронирование*\n\n" +
      "Откройте залы и выберите удобное время прямо в приложении — " +
      "без пошагового диалога.",
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().webApp(
        "Открыть онлайн-бронирование",
        MINI_APP_URL
      )
    }
  );
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
        `💰 ${formatPrice(Number(b.totalPrice))} сум\n`
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
 * Настройка меню бота
 *
 * Убирает список команд («/»-меню) и заменяет кнопку-меню единственной
 * кнопкой «Забронировать», которая сразу открывает Mini App.
 * ========================================================================= */

export async function setupBotMenu(): Promise<void> {
  try {
    await bot.api.setMyCommands([]);
  } catch (err) {
    console.warn("[bot] setMyCommands failed", err);
  }

  try {
    // ВАЖНО: параметр называется menu_button (старое поле из MTProto).
    // «button» из спецификации Bot API сервер принимает, но молча игнорирует,
    // поэтому дефолтная кнопка не менялась. Обходим типы grammY через raw.
    await bot.api.raw.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "Забронировать",
        web_app: { url: MINI_APP_URL }
      }
    } as unknown as Parameters<
      typeof bot.api.raw.setChatMenuButton
    >[0]);
  } catch (err) {
    console.warn("[bot] setChatMenuButton failed", err);
  }
}

export default bot;