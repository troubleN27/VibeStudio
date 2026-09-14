/**
 * URL Telegram Mini App — кнопка «web_app» в боте открывает страницу
 * онлайн-бронирования внутри Telegram.
 *
 * Используется существующая страница /booking; в продакшене деплой
 * алиасен на vibe-studio-mauve.vercel.app.
 */
export const MINI_APP_URL = `${
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vibe-studio-mauve.vercel.app"
}/booking`;