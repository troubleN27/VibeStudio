import { InlineKeyboard } from "grammy";
import { prisma } from "@/lib/prisma";

/**
 * Callback-данные для кнопок выбора услуги.
 * Формат: "svc:<id>"
 */
export const SERVICE_CALLBACK_PREFIX = "svc:";

/**
 * Callback-данные для кнопки «Назад» (возврат к выбору зала).
 */
export const BACK_TO_HALLS_CALLBACK = "back:halls";

/**
 * Форматирование длительности: 60 → "1 ч", 90 → "1 ч 30 мин".
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

/**
 * Форматирование цены: 250000 → "250 000".
 */
function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU").format(price);
}

/**
 * Строит inline-клавиатуру со списком активных услуг выбранного зала.
 * На кнопке — название и подпись с ценой/длительностью через "\n".
 *
 * Последняя строка — кнопка «⬅️ Назад» к выбору зала.
 */
export async function servicesKeyboard(
  hallId: string
): Promise<InlineKeyboard> {
  const services = await prisma.service.findMany({
    where: { hallId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      price: true,
      durationMin: true
    }
  });

  const kb = new InlineKeyboard();

  for (const s of services) {
    const label = `${s.name} · ${formatPrice(
      Number(s.price)
    )} сум · ${formatDuration(s.durationMin)}`;
    kb.text(label, `${SERVICE_CALLBACK_PREFIX}${s.id}`).row();
  }

  kb.text("⬅️ Назад", BACK_TO_HALLS_CALLBACK);

  return kb;
}

/**
 * Извлекает serviceId из callback-данных.
 * Возвращает null, если данные не подходят под формат.
 */
export function parseServiceCallback(data: string): string | null {
  if (!data.startsWith(SERVICE_CALLBACK_PREFIX)) return null;
  const id = data.slice(SERVICE_CALLBACK_PREFIX.length);
  return id.length > 0 ? id : null;
}