import { getAvailability, NotFoundError } from "@/lib/booking-service";
import { formatDateRu } from "@/lib/dates";
import { escapeMarkdown } from "@/lib/format";
import {
  timeSlotsKeyboard,
  parseTimeCallback,
  BACK_TO_DATES_CALLBACK
} from "../keyboards/timeSlotsKeyboard";
import type { BotContext } from "../session";

/**
 * Экран выбора времени.
 * Требует, чтобы в сессии были заполнены hallId, serviceId и date.
 *
 * Запрашивает доступные слоты через общий booking-service (B6) — тот же,
 * что использует веб-сайт. Никаких дублирующих правил доступности.
 */
export async function showSelectTime(ctx: BotContext): Promise<void> {
  const { hallId, serviceId, date } = ctx.session;
  if (!hallId || !serviceId || !date) {
    const { showSelectDate } = await import("./selectDate");
    await showSelectDate(ctx);
    return;
  }

  ctx.session.step = "select_time";

  let slots: string[] = [];
  try {
    const availability = await getAvailability(hallId, serviceId, date);
    slots = availability.slots;
  } catch (err) {
    if (err instanceof NotFoundError) {
      await ctx.reply(
        "😔 Услуга больше недоступна. Выберите другую.",
        {
          reply_markup: timeSlotsKeyboard([], null)
        }
      );
      // Передаём управление назад к выбору услуги
      const { showSelectService } = await import("./selectService");
      await showSelectService(ctx);
      return;
    }
    console.error("[showSelectTime] getAvailability failed", err);
    await ctx.reply(
      "⚠️ Не удалось получить доступное время. Попробуйте позже."
    );
    return;
  }

  const dateLine = `🗓 Дата: *${formatDateRu(date)}*\n`;
  const serviceLine = ctx.session.serviceName
    ? `✨ Услуга: *${escapeMarkdown(ctx.session.serviceName)}*\n`
    : "";

  const header =
    serviceLine + dateLine + "\n🗓 *Шаг 4 из 5.* Выберите время:";

  const text =
    slots.length === 0
      ? header + "\n\n_Нет свободного времени на эту дату._"
      : header;

  const kb = timeSlotsKeyboard(slots, ctx.session.startTime ?? null);

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: kb
      });
    } catch {
      // "message is not modified" — игнорируем
    }
  } else {
    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: kb
    });
  }
}

/**
 * Обработчик выбора времени.
 * Сохраняет startTime в сессию и переходит к вводу имени клиента.
 *
 * ВАЖНО: перед переходом ещё раз проверяем, что слот всё ещё доступен.
 * Между показом клавиатуры и нажатием могло пройти время — другой клиент
 * мог успеть забронировать этот слот с сайта или из своего бота.
 *
 * @returns true, если callback относился к этой сцене.
 */
export async function handleTimeSelected(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  const time = parseTimeCallback(callbackData);
  if (!time) return false;

  const { hallId, serviceId, date } = ctx.session;
  if (!hallId || !serviceId || !date) {
    await ctx.answerCallbackQuery({
      text: "Сессия устарела. Начните заново командой /start.",
      show_alert: true
    });
    return true;
  }

  // Реактивная проверка доступности выбранного слота
  try {
    const availability = await getAvailability(hallId, serviceId, date);
    if (!availability.slots.includes(time)) {
      await ctx.answerCallbackQuery({
        text: "Этот слот уже занят. Выберите другое время.",
        show_alert: true
      });
      await showSelectTime(ctx);
      return true;
    }
  } catch (err) {
    console.error("[handleTimeSelected] availability check failed", err);
    await ctx.answerCallbackQuery({
      text: "Не удалось проверить слот. Попробуйте снова.",
      show_alert: true
    });
    return true;
  }

  await ctx.answerCallbackQuery();

  ctx.session.startTime = time;

  const { showEnterContact } = await import("./enterContact");
  await showEnterContact(ctx);
  return true;
}

/**
 * Обработчик кнопки «⬅️ Назад» на экране выбора времени.
 * Возвращает пользователя к выбору даты.
 *
 * @returns true, если callback относился к этой сцене.
 */
export async function handleBackToDates(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  if (callbackData !== BACK_TO_DATES_CALLBACK) return false;

  await ctx.answerCallbackQuery();
  const { showSelectDate } = await import("./selectDate");
  await showSelectDate(ctx);
  return true;
}