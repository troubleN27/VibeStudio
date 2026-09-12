/**
 * Уведомления администратору студии в Telegram.
 *
 * Ходит в Telegram Bot API напрямую через fetch — без Grammy,
 * чтобы не тянуть bot instance в API-роуты Next.js и не иметь
 * зависимости от порядка инициализации.
 *
 * Если TELEGRAM_BOT_TOKEN или TELEGRAM_ADMIN_CHAT_ID не заданы —
 * функция тихо ничего не делает. Ошибки отправки не выбрасываются,
 * а логируются: неудача уведомления не должна ломать бизнес-операцию
 * (создание брони, отмену и т.п.).
 */

const TELEGRAM_API = "https://api.telegram.org";

type SendMessageResult = {
  ok: boolean;
  description?: string;
};

/**
 * Отправляет произвольный текст в чат администратора.
 * @param text Текст сообщения (Markdown не парсится — используем plain text,
 *             чтобы избежать проблем с экранированием имён и телефонов).
 * @returns true, если сообщение успешно отправлено.
 */
export async function notifyAdmin(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIdRaw = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatIdRaw) {
    return false;
  }

  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId)) {
    console.warn(
      "[notifyAdmin] TELEGRAM_ADMIN_CHAT_ID не является числом, уведомление пропущено"
    );
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      }),
      // Не ждём бесконечно — Telegram быстрый, 5 секунд с запасом
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | SendMessageResult
        | null;
      console.warn(
        `[notifyAdmin] Telegram API вернул ${res.status}: ${
          body?.description ?? "unknown error"
        }`
      );
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[notifyAdmin] Не удалось отправить уведомление", err);
    return false;
  }
}

/**
 * Форматирует уведомление о новой брони в читаемый блок.
 * Использует обычные переводы строк, без Markdown.
 */
export function formatBookingNotification(params: {
  hallName: string;
  serviceName: string;
  date: string; // "YYYY-MM-DD"
  startTime: string;
  endTime: string;
  clientName: string;
  clientPhone: string;
  totalPrice: number;
  source: "WEBSITE" | "TELEGRAM";
  bookingId: string;
}): string {
  const sourceLabel = params.source === "WEBSITE" ? "🌐 Сайт" : "🤖 Telegram";
  const priceFormatted = new Intl.NumberFormat("ru-RU").format(
    params.totalPrice
  );

  return [
    "🔔 Новая бронь",
    "",
    `Источник: ${sourceLabel}`,
    `Зал: ${params.hallName}`,
    `Услуга: ${params.serviceName}`,
    `Дата: ${formatDateRu(params.date)}`,
    `Время: ${params.startTime} — ${params.endTime}`,
    "",
    `Клиент: ${params.clientName}`,
    `Телефон: ${params.clientPhone}`,
    `Сумма: ${priceFormatted} сум`,
    "",
    `ID: ${params.bookingId}`
  ].join("\n");
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