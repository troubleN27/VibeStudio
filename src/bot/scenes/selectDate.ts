import {
  calendarKeyboard,
  parseDateCallback,
  CAL_PREV_CALLBACK,
  CAL_NEXT_CALLBACK,
  BACK_TO_SERVICES_CALLBACK
} from "../keyboards/calendarKeyboard";
import type { BotContext } from "../session";

/**
 * Экран выбора даты.
 * Требует, чтобы ctx.session.hallId и ctx.session.serviceId были заполнены.
 *
 * Состояние отображаемого месяца хранится в сессии
 * (calendarYear / calendarMonth), чтобы навигация ◀️/▶️ и возвраты
 * сохраняли текущий месяц.
 */
export async function showSelectDate(ctx: BotContext): Promise<void> {
  const { hallId, serviceId } = ctx.session;
  if (!hallId || !serviceId) {
    const { showSelectHall } = await import("./selectHall");
    await showSelectHall(ctx);
    return;
  }

  ctx.session.step = "select_date";

  // Если месяц ещё не задан — показываем текущий (UTC)
  if (
    ctx.session.calendarYear === undefined ||
    ctx.session.calendarMonth === undefined
  ) {
    const now = new Date();
    ctx.session.calendarYear = now.getUTCFullYear();
    ctx.session.calendarMonth = now.getUTCMonth();
  }

  await renderCalendar(ctx);
}

/**
 * Перерисовывает сообщение с календарём.
 * Использует editMessageText, т.к. все переходы — по inline-кнопкам.
 */
async function renderCalendar(ctx: BotContext): Promise<void> {
  const year = ctx.session.calendarYear ?? new Date().getUTCFullYear();
  const monthIndex = ctx.session.calendarMonth ?? new Date().getUTCMonth();

  const { keyboard, title } = calendarKeyboard(
    year,
    monthIndex,
    ctx.session.date ?? null
  );

  const serviceLine = ctx.session.serviceName
    ? `✨ Услуга: *${escapeMarkdown(ctx.session.serviceName)}*\n\n`
    : "";

  const text =
    serviceLine +
    `🗓 *Шаг 3 из 5.* Выберите дату:\n\n${title}`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });
    } catch {
      // Telegram может вернуть "message is not modified" — игнорируем
    }
  } else {
    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  }
}

/**
 * Обработчик нажатия на конкретный день в календаре.
 * Сохраняет дату в сессию и переходит к выбору времени.
 *
 * @returns true, если callback относился к этой сцене.
 */
export async function handleDateSelected(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  const iso = parseDateCallback(callbackData);
  if (!iso) return false;

  await ctx.answerCallbackQuery();

  ctx.session.date = iso;
  ctx.session.startTime = undefined; // слоты для новой даты пересчитываются

  const { showSelectTime } = await import("./selectTime");
  await showSelectTime(ctx);
  return true;
}

/**
 * Обработчик кнопок навигации по месяцам (◀️ / ▶️).
 * Меняет calendarYear/calendarMonth и перерисовывает календарь.
 *
 * @returns true, если callback относился к этой сцене.
 */
export async function handleCalendarNavigation(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  if (callbackData !== CAL_PREV_CALLBACK && callbackData !== CAL_NEXT_CALLBACK) {
    return false;
  }

  await ctx.answerCallbackQuery();

  let year = ctx.session.calendarYear ?? new Date().getUTCFullYear();
  let month = ctx.session.calendarMonth ?? new Date().getUTCMonth();

  if (callbackData === CAL_PREV_CALLBACK) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  } else {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  ctx.session.calendarYear = year;
  ctx.session.calendarMonth = month;

  await renderCalendar(ctx);
  return true;
}

/**
 * Обработчик кнопки «⬅️ Назад» на экране календаря.
 * Возвращает пользователя к выбору услуги.
 *
 * @returns true, если callback относился к этой сцене.
 */
export async function handleBackToServices(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  if (callbackData !== BACK_TO_SERVICES_CALLBACK) return false;

  await ctx.answerCallbackQuery();
  const { showSelectService } = await import("./selectService");
  await showSelectService(ctx);
  return true;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[])/g, "\\$1");
}