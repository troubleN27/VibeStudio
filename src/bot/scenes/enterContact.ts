import { InlineKeyboard, Keyboard } from "grammy";
import { phoneSchema } from "@/lib/validation/booking.schema";
import type { BotContext } from "../session";

/**
 * Callback-префиксы кнопок «⬅️ Назад» в этой сцене.
 */
export const BACK_TO_TIMES_CALLBACK = "back:times";
export const BACK_TO_NAME_CALLBACK = "back:name";

const CANCEL_TEXT = "✖️ Отмена";

/**
 * Шаг 5 сценария: ввод контактных данных.
 *
 *  - Сначала спрашиваем имя (свободный текст).
 *  - Затем телефон: либо текстом, либо через reply-кнопку «Отправить контакт».
 *  - После получения обоих полей — переход к подтверждению.
 */

/* =========================================================================
 * Экран ввода имени
 * ========================================================================= */

export async function showEnterContact(ctx: BotContext): Promise<void> {
  const { hallId, serviceId, date, startTime } = ctx.session;
  if (!hallId || !serviceId || !date || !startTime) {
    const { showSelectTime } = await import("./selectTime");
    await showSelectTime(ctx);
    return;
  }

  ctx.session.step = "enter_name";

  const kb = new InlineKeyboard().text("⬅️ Назад", BACK_TO_TIMES_CALLBACK);

  const text =
    "📋 *Шаг 5 из 5.* Осталось совсем немного.\n\n" +
    "✍️ Напишите, пожалуйста, ваше *имя*:";

  // Убедимся, что старая reply keyboard (если была) убрана
  await ctx.reply("…", { reply_markup: { remove_keyboard: true } });

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: kb
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: kb
      });
    }
  } else {
    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: kb
    });
  }
}

/* =========================================================================
 * Обработка имени (приходит текстом)
 * ========================================================================= */

/**
 * Обрабатывает текстовое сообщение на шаге enter_name.
 * Проверяет имя через простую логику (2–100 символов) и переходит
 * к экрану ввода телефона.
 *
 * @returns true, если сообщение было обработано этой сценой.
 */
export async function handleNameInput(
  ctx: BotContext,
  text: string
): Promise<boolean> {
  if (ctx.session.step !== "enter_name") return false;

  const trimmed = text.trim();

  if (trimmed.length < 2 || trimmed.length > 100) {
    await ctx.reply(
      "⚠️ Имя должно быть от 2 до 100 символов. Попробуйте ещё раз:"
    );
    return true;
  }

  // Отсекаем попытку нажать reply-кнопку, которой здесь быть не должно
  if (trimmed === CANCEL_TEXT) {
    const { showSelectTime } = await import("./selectTime");
    await showSelectTime(ctx);
    return true;
  }

  ctx.session.clientName = trimmed;
  await showEnterPhone(ctx);
  return true;
}

/* =========================================================================
 * Экран ввода телефона
 * ========================================================================= */

export async function showEnterPhone(ctx: BotContext): Promise<void> {
  ctx.session.step = "enter_phone";

  const replyKb = new Keyboard()
    .requestContact("📱 Отправить контакт")
    .resized()
    .oneTime();

  const inlineKb = new InlineKeyboard().text(
    "⬅️ Назад",
    BACK_TO_NAME_CALLBACK
  );

  const name = ctx.session.clientName ?? "";
  const text =
    `Спасибо, *${escapeMarkdown(name)}*.\n\n` +
    "☎️ Теперь отправьте *номер телефона* — напишите текстом " +
    "или нажмите кнопку ниже:";

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: replyKb
  });

  // Отдельным сообщением — inline-кнопка «Назад»
  await ctx.reply("Можно изменить имя:", {
    reply_markup: inlineKb
  });
}

/* =========================================================================
 * Обработка телефона (текст или contact)
 * ========================================================================= */

/**
 * Обрабатывает телефон, введённый текстом, на шаге enter_phone.
 *
 * @returns true, если сообщение было обработано этой сценой.
 */
export async function handlePhoneInput(
  ctx: BotContext,
  text: string
): Promise<boolean> {
  if (ctx.session.step !== "enter_phone") return false;

  const trimmed = text.trim();

  if (trimmed === CANCEL_TEXT) {
    const { showSelectTime } = await import("./selectTime");
    await showSelectTime(ctx);
    return true;
  }

  const parsed = phoneSchema.safeParse(trimmed);
  if (!parsed.success) {
    await ctx.reply(
      "⚠️ Похоже, это не номер телефона. Пример: +998901234567"
    );
    return true;
  }

  ctx.session.clientPhone = parsed.data;

  // Убираем reply keyboard перед переходом дальше
  await ctx.reply("Принято ✅", {
    reply_markup: { remove_keyboard: true }
  });

  const { showConfirm } = await import("./confirmBooking");
  await showConfirm(ctx);
  return true;
}

/**
 * Обрабатывает присланный пользователем контакт (reply-кнопка «Отправить контакт»).
 *
 * @returns true, если сообщение было обработано этой сценой.
 */
export async function handleContactShared(
  ctx: BotContext,
  phoneNumber: string
): Promise<boolean> {
  if (ctx.session.step !== "enter_phone") return false;

  // Telegram может прислать номер без "+" — нормализуем
  let normalized = phoneNumber.replace(/[\s\-()]/g, "");
  if (!normalized.startsWith("+")) normalized = `+${normalized}`;

  const parsed = phoneSchema.safeParse(normalized);
  if (!parsed.success) {
    await ctx.reply(
      "⚠️ Не удалось распознать номер. Введите его вручную, например: +998901234567"
    );
    return true;
  }

  ctx.session.clientPhone = parsed.data;

  await ctx.reply("Принято ✅", {
    reply_markup: { remove_keyboard: true }
  });

  const { showConfirm } = await import("./confirmBooking");
  await showConfirm(ctx);
  return true;
}

/* =========================================================================
 * Навигация «⬅️ Назад»
 * ========================================================================= */

/**
 * Обработчик кнопки «⬅️ Назад» на экране ввода имени.
 * Возвращает пользователя к выбору времени.
 */
export async function handleBackToTimes(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  if (callbackData !== BACK_TO_TIMES_CALLBACK) return false;
  await ctx.answerCallbackQuery();
  const { showSelectTime } = await import("./selectTime");
  await showSelectTime(ctx);
  return true;
}

/**
 * Обработчик кнопки «⬅️ Назад» на экране ввода телефона.
 * Возвращает пользователя к вводу имени.
 */
export async function handleBackToName(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  if (callbackData !== BACK_TO_NAME_CALLBACK) return false;
  await ctx.answerCallbackQuery();

  // Убираем reply keyboard «Отправить контакт», возвращаемся к вводу имени
  await ctx.reply("Возвращаемся к имени.", {
    reply_markup: { remove_keyboard: true }
  });

  await showEnterContact(ctx);
  return true;
}

/* =========================================================================
 * Утилиты
 * ========================================================================= */

function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[])/g, "\\$1");
}