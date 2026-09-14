import { InlineKeyboard } from "grammy";
import { prisma } from "@/lib/prisma";
import { formatDuration, formatPrice } from "@/lib/format";

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