/**
 * Чистые утилиты работы с датами и временем.
 * Кросс-платформенные (server + client), без зависимостей.
 *
 * В приложении используется следующая договорённость:
 *  - даты хранятся в БД как UTC-полночь "YYYY-MM-DD" (см. dateKeyToUtc);
 *  - время — строки "HH:MM" без зоны.
 */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "HH:MM" → количество минут от начала суток. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Минуты от начала суток → "HH:MM". */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Прибавляет минуты к "HH:MM" и возвращает "HH:MM" (с переносом через полночь). */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/** Сравнение двух "HH:MM": возвращает разницу в минутах (a − b). */
export function compareTime(a: string, b: string): number {
  return timeToMinutes(a) - timeToMinutes(b);
}

/**
 * Приводит "YYYY-MM-DD" к Date в 00:00 UTC.
 * Это «канонический» ключ даты, который пишется в БД
 * (Booking.date, BlockedSlot.date).
 */
export function dateKeyToUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Date → "YYYY-MM-DD" по UTC-компонентам (обратно к dateKeyToUtc). */
export function dateToIsoUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** UTC-полночь текущего дня. */
export function startOfTodayUtc(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/** "YYYY-MM-DD" → "12 сентября 2026" (по UTC). */
export function formatDateRu(iso: string): string {
  const d = dateKeyToUtc(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

/* =========================================================================
 * Хелперы для локальной (timezone-пользователя) работы с <input type="date">.
 * ========================================================================= */

/** Сегодня по локальному времени → "YYYY-MM-DD". */
export function todayIsoLocal(d: Date = new Date()): string {
  return toIsoParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Сдвигает "YYYY-MM-DD" на days дней (локальная интерпретация) → "YYYY-MM-DD". */
export function addDaysIsoLocal(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Текущий месяц "YYYY-MM" (локально) — для <input type="month">. */
export function currentMonthIsoLocal(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

function toIsoParts(y: number, m: number, day: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}