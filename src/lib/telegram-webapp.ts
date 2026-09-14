import { createHmac, timingSafeEqual } from "crypto";

/**
 * Серверная валидация initData Telegram Mini App.
 *
 * initData — строка query-подобных параметров, которую Telegram передаёт
 * в mini app: `query_id=...&user={...}&auth_date=...&hash=...`.
 *
 * Проверка подписи по документации:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

export type TelegramUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

/** initData перестаёт быть валидной через сутки (защита от повторов). */
const MAX_INIT_DATA_AGE_SEC = 24 * 60 * 60;

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

/** Сравнение hex без раннего выхода (constant-time). */
function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Строка для проверки подписи: все поля кроме `hash`,
 * отсортированные по ключу, в виде `key=value`.
 */
function dataCheckString(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

/**
 * Проверяет подпись initData и возвращает данные пользователя Telegram.
 * Возвращает null, если: подпись не сошлась, данные устарели,
 * Telegram-пользователь не указан или не настроен TELEGRAM_BOT_TOKEN.
 */
export function validateTelegramInitData(
  initData: string
): TelegramUser | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  if (!hash) return null;

  const secretKey = hmacSha256("WebAppData", botToken);
  const computed = hmacSha256(secretKey, dataCheckString(params)).toString(
    "hex"
  );
  if (!safeEqualHex(computed, hash)) return null;

  const authDate = Number(params.get("auth_date") ?? "0");
  if (!authDate) return null;
  if (Math.floor(Date.now() / 1000) - authDate > MAX_INIT_DATA_AGE_SEC) {
    return null;
  }

  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    const user = JSON.parse(userRaw) as {
      id?: number | string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    if (user.id === undefined) return null;
    return {
      id: String(user.id),
      username: user.username ?? null,
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null
    };
  } catch {
    return null;
  }
}