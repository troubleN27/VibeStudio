import { prisma } from "@/lib/prisma";
import { escapeMarkdown } from "@/lib/format";
import {
  servicesKeyboard,
  parseServiceCallback,
  BACK_TO_HALLS_CALLBACK
} from "../keyboards/servicesKeyboard";
import type { BotContext } from "../session";

/**
 * Экран выбора услуги для уже выбранного зала.
 * Требует, чтобы ctx.session.hallId был заполнен.
 */
export async function showSelectService(ctx: BotContext): Promise<void> {
  const hallId = ctx.session.hallId;
  if (!hallId) {
    // Защита от некорректного состояния — возвращаемся к выбору зала
    const { showSelectHall } = await import("./selectHall");
    await showSelectHall(ctx);
    return;
  }

  ctx.session.step = "select_service";

  const hallName = ctx.session.hallName ?? "зал";

  const count = await prisma.service.count({
    where: { hallId, isActive: true }
  });

  const text =
    `🏛 Зал: *${escapeMarkdown(hallName)}*\n\n` +
    (count === 0
      ? "😔 Для этого зала пока нет доступных услуг."
      : "✨ *Шаг 2 из 5.* Выберите услугу:");

  if (count === 0) {
    // Показываем только кнопку «Назад» к выбору зала
    const kb = (await servicesKeyboard(hallId)); // вернёт клавиатуру с одной кнопкой назад
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: kb
      });
    } else {
      await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: kb
      });
    }
    return;
  }

  const kb = await servicesKeyboard(hallId);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: kb
    });
  } else {
    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: kb
    });
  }
}

/**
 * Обработчик нажатия на кнопку выбора услуги.
 * Проверяет, что услуга существует, активна и принадлежит выбранному залу.
 *
 * @returns true, если callback относился к этой сцене.
 */
export async function handleServiceSelected(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  const serviceId = parseServiceCallback(callbackData);
  if (!serviceId) return false;

  if (!ctx.session.hallId) {
    await ctx.answerCallbackQuery({
      text: "Сессия устарела. Начните заново командой /start.",
      show_alert: true
    });
    return true;
  }

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      hallId: ctx.session.hallId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      price: true,
      durationMin: true
    }
  });

  if (!service) {
    await ctx.answerCallbackQuery({
      text: "Эта услуга больше недоступна. Выберите другую.",
      show_alert: true
    });
    await showSelectService(ctx);
    return true;
  }

  await ctx.answerCallbackQuery();

  ctx.session.serviceId = service.id;
  ctx.session.serviceName = service.name;
  ctx.session.servicePrice = Number(service.price);
  ctx.session.serviceDurationMin = service.durationMin;

  // Сбрасываем всё, что зависит от услуги
  ctx.session.date = undefined;
  ctx.session.startTime = undefined;

  const { showSelectDate } = await import("./selectDate");
  await showSelectDate(ctx);
  return true;
}

/**
 * Обработчик кнопки «⬅️ Назад» на экране выбора услуги.
 * Возвращает пользователя к выбору зала.
 *
 * @returns true, если callback относился к этой сцене.
 */
export async function handleBackToHalls(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  if (callbackData !== BACK_TO_HALLS_CALLBACK) return false;

  await ctx.answerCallbackQuery();
  const { showSelectHall } = await import("./selectHall");
  await showSelectHall(ctx);
  return true;
}