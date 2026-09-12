import { prisma } from "@/lib/prisma";
import { hallsKeyboard, parseHallCallback } from "../keyboards/hallsKeyboard";
import type { BotContext } from "../session";
import { showSelectService } from "./selectService";

/**
 * Экран выбора зала.
 * Вызывается из /start и из любых «назад»-переходов к первому шагу.
 */
export async function showSelectHall(ctx: BotContext): Promise<void> {
  // Полный сброс предыдущего выбора при входе в сценарий
  ctx.session.step = "select_hall";
  ctx.session.hallId = undefined;
  ctx.session.hallName = undefined;
  ctx.session.serviceId = undefined;
  ctx.session.serviceName = undefined;
  ctx.session.serviceDurationMin = undefined;
  ctx.session.servicePrice = undefined;
  ctx.session.date = undefined;
  ctx.session.startTime = undefined;

  const count = await prisma.hall.count({ where: { isActive: true } });
  if (count === 0) {
    ctx.session.step = "idle";
    await ctx.reply(
      "😔 Пока нет доступных залов для бронирования.\nПопробуйте позже."
    );
    return;
  }

  const kb = await hallsKeyboard();

  const text =
    "📸 *Vibe Studio*\n\n" +
    "Добро пожаловать! Я помогу забронировать студию.\n\n" +
    "🏛 *Шаг 1 из 5.* Выберите зал:";

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
 * Обработчик нажатия на кнопку выбора зала.
 * Проверяет, что зал активен и существует, сохраняет его в сессию
 * и передаёт управление следующей сцене (выбор услуги).
 *
 * @returns true, если зал найден и обработан; false — если callback мусорный.
 */
export async function handleHallSelected(
  ctx: BotContext,
  callbackData: string
): Promise<boolean> {
  const hallId = parseHallCallback(callbackData);
  if (!hallId) return false;

  const hall = await prisma.hall.findFirst({
    where: { id: hallId, isActive: true },
    select: { id: true, name: true }
  });

  if (!hall) {
    await ctx.answerCallbackQuery({
      text: "Этот зал больше недоступен. Выберите другой.",
      show_alert: true
    });
    await showSelectHall(ctx);
    return true;
  }

  await ctx.answerCallbackQuery();

  ctx.session.hallId = hall.id;
  ctx.session.hallName = hall.name;

  // Сбрасываем всё, что зависит от зала
  ctx.session.serviceId = undefined;
  ctx.session.serviceName = undefined;
  ctx.session.serviceDurationMin = undefined;
  ctx.session.servicePrice = undefined;
  ctx.session.date = undefined;
  ctx.session.startTime = undefined;

  await showSelectService(ctx);
  return true;
}