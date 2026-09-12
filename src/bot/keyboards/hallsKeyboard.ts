import { InlineKeyboard } from "grammy";
import { prisma } from "@/lib/prisma";

/**
 * Callback-данные для кнопок выбора зала.
 * Формат: "hall:<id>"
 */
export const HALL_CALLBACK_PREFIX = "hall:";

/**
 * Строит inline-клавиатуру со списком активных залов.
 * Каждая кнопка — одна строка (залы с длинными названиями не влезают в 2 колонки).
 *
 * Если залов нет — возвращает клавиатуру без кнопок (только отмена).
 */
export async function hallsKeyboard(): Promise<InlineKeyboard> {
  const halls = await prisma.hall.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true }
  });

  const kb = new InlineKeyboard();

  for (const hall of halls) {
    kb.text(hall.name, `${HALL_CALLBACK_PREFIX}${hall.id}`).row();
  }

  return kb;
}

/**
 * Извлекает hallId из callback-данных.
 * Возвращает null, если данные не подходят под формат.
 */
export function parseHallCallback(data: string): string | null {
  if (!data.startsWith(HALL_CALLBACK_PREFIX)) return null;
  const id = data.slice(HALL_CALLBACK_PREFIX.length);
  return id.length > 0 ? id : null;
}