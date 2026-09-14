/**
 * Общие форматирующие утилиты (цены, длительности, множественные числа,
 * экранирование Markdown). Чистый модуль — работает и на сервере, и на клиенте.
 */

const ruNumber = new Intl.NumberFormat("ru-RU", {
  style: "decimal",
  maximumFractionDigits: 0
});

/** 250000 → "250 000". */
export function formatPrice(price: number): string {
  return ruNumber.format(price);
}

/** 60 → "1 ч", 90 → "1 ч 30 мин", 30 → "30 мин". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

/** Русские множественные числа: pluralRu(3, ["запись","записи","записей"]) → "записи". */
export function pluralRu(
  n: number,
  [one, few, many]: [string, string, string]
): string {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (d >= 2 && d <= 4) return few;
  if (d === 1) return one;
  return many;
}

/**
 * Экранирование спецсимволов Markdown (legacy, parse_mode: "Markdown").
 * Экранируем `_`, `*`, `` ` `` и `[` — достаточно для текстов бота.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[])/g, "\\$1");
}