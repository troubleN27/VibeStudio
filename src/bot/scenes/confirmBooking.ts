import { InlineKeyboard } from "grammy";
import {
  createBooking,
  SlotUnavailableError,
  NotFoundError,
  InvalidSlotError
} from "@/lib/booking-service";
import { notifyAdmin, formatBookingNotification } from "@/lib/telegram-notify";
import type { BotContext } from "../session";
import { resetSessionData } from "../session";

/**
 * Callback-префиксы на экране подтверждения.
 */
export const CONFIRM_CALLBACK = "confirm:yes";
export const CANCEL_CALLBACK = "confirm:no";

/**
 * Финальный экран сценария: сводка по брони + кнопки «Подтвердить» / «Отмена».
 * Требует, чтобы все поля сессии были заполнены.
 */
export async function showConfirm(ctx: BotContext): Promise<void> {
  const {
    hallId,
    hallName,
    serviceId,
    serviceName,
    serviceDurationMin,
    servicePrice,
    date,
    startTime,
    clientName,
    clientPhone
  } = ctx.session;

  if (
    !hallId ||
    !serviceId ||
    !date ||
    !startTime ||
    !clientName ||
    !clientPhone ||
    !serviceDurationMin
  ) {
    const { showSelectTime } = await import("./selectTime");
    await showSelectTime(ctx);
    return;
  }

  ctx.session.step = "confirm";

  const endTime = addMinutes(startTime, serviceDurationMin);

  const text =
    "🧾 *Проверьте детали брони:*\n\n" +
    `🏛 Зал: *${escapeMarkdown(hallName ?? "—")}*\n` +
    `✨ Услуга: *${escapeMarkdown(serviceName ?? "—")}*\n` +
    `🗓 Дата: *${formatDateRu(date)}*\n` +
    `⏰ Время: *${startTime} — ${endTime}*\n` +
    `⌛ Длительность: *${serviceDurationMin} мин*\n\n` +
    `👤 Имя: *${escapeMarkdown(clientName)}*\n` +
    `☎️ Телефон: *${escapeMarkdown(clientPhone)}*\n\n` +
    `💰 Итого: *${formatPrice(servicePrice ?? 0)} сум*`;

  const kb = new InlineKeyboard()
    .text("✅ Подтвердить", CONFIRM_CALLBACK)
    .text("✖️ Отмена", CANCEL_CALLBACK);

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

/**
 * Обработчик нажатия «✅ Подтвердить».
 * Создаёт бронь через общий booking-service. Здесь срабатывает
 * финальная защита от гонок (транзакция внутри createBooking).
 */
export async function handleConfirm(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  if (callbackData !== CONFIRM_CALLBACK) return false;

  const {
    hallId,
    serviceId,
    date,
    startTime,
    clientName,
    clientPhone
  } = ctx.session;

  if (
    !hallId ||
    !serviceId ||
    !date ||
    !startTime ||
    !clientName ||
    !clientPhone
  ) {
    await ctx.answerCallbackQuery({
      text: "Сессия устарела. Начните заново командой /start.",
      show_alert: true
    });
    ctx.session = resetSessionData(ctx.session);
    return true;
  }

  await ctx.answerCallbackQuery({ text: "Создаём бронь..." });

  try {
    const booking = await createBooking({
      hallId,
      serviceId,
      date,
      startTime,
      clientName,
      clientPhone,
      source: "TELEGRAM",
      telegramId:
        ctx.chat?.id !== undefined ? String(ctx.chat.id) : undefined
    });

    const successText =
      "✅ *Бронь подтверждена!*\n\n" +
      `🏛 Зал: *${escapeMarkdown(booking.hall.name)}*\n` +
      `✨ Услуга: *${escapeMarkdown(booking.service.name)}*\n` +
      `🗓 Дата: *${formatDateRu(booking.date)}*\n` +
      `⏰ Время: *${booking.startTime} — ${booking.endTime}*\n` +
      `💰 Итого: *${formatPrice(booking.totalPrice)} сум*\n\n` +
      `Номер брони: \`${booking.id}\`\n\n` +
      "Ждём вас в Vibe Studio! 📸";

    // Сбрасываем сессию до отправки сообщения, чтобы /start сразу работал
    ctx.session = resetSessionData(ctx.session);

    try {
      await ctx.editMessageText(successText, {
        parse_mode: "Markdown"
      });
    } catch {
      await ctx.reply(successText, { parse_mode: "Markdown" });
    }

    // Уведомление админу — через общий хелпер, тот же, что использует API.
    // Fire-and-forget: не блокируем ответ пользователю.
    void notifyAdmin(
      formatBookingNotification({
        hallName: booking.hall.name,
        serviceName: booking.service.name,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        clientName: booking.client.name,
        clientPhone: booking.client.phone,
        totalPrice: booking.totalPrice,
        source: "TELEGRAM",
        bookingId: booking.id
      })
    );
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      await ctx.reply(
        "⚠️ Это время только что заняли. Давайте выберем другое."
      );
      ctx.session.startTime = undefined;
      const { showSelectTime } = await import("./selectTime");
      await showSelectTime(ctx);
      return true;
    }

    if (err instanceof InvalidSlotError) {
      await ctx.reply(
        `⚠️ ${err.message}. Пожалуйста, выберите другое время.`
      );
      ctx.session.startTime = undefined;
      const { showSelectTime } = await import("./selectTime");
      await showSelectTime(ctx);
      return true;
    }

    if (err instanceof NotFoundError) {
      await ctx.reply(
        "😔 Услуга или зал больше недоступны. Начните заново командой /start."
      );
      ctx.session = resetSessionData(ctx.session);
      return true;
    }

    console.error("[handleConfirm] createBooking failed", err);
    await ctx.reply(
      "⚠️ Не удалось создать бронь. Попробуйте ещё раз чуть позже."
    );
  }

  return true;
}

/**
 * Обработчик нажатия «✖️ Отмена».
 */
export async function handleCancelConfirm(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  if (callbackData !== CANCEL_CALLBACK) return false;

  await ctx.answerCallbackQuery();

  ctx.session = resetSessionData(ctx.session);

  try {
    await ctx.editMessageText(
      "✖️ Бронирование отменено.\n\nЧтобы начать заново, отправьте /start."
    );
  } catch {
    await ctx.reply(
      "✖️ Бронирование отменено.\n\nЧтобы начать заново, отправьте /start."
    );
  }

  return true;
}

/* =========================================================================
 * Утилиты
 * ========================================================================= */

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
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

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU").format(price);
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[])/g, "\\$1");
}