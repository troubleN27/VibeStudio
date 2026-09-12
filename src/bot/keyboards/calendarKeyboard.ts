import { InlineKeyboard } from "grammy";

/**
 * Callback-префиксы.
 *
 *  - date:<YYYY-MM-DD>   — выбор даты
 *  - cal:prev / cal:next — навигация по месяцам
 *  - cal:noop            — «пустая» кнопка (для выравнивания сетки)
 *  - back:services       — возврат к выбору услуги
 */
export const DATE_CALLBACK_PREFIX = "date:";
export const CAL_PREV_CALLBACK = "cal:prev";
export const CAL_NEXT_CALLBACK = "cal:next";
export const CAL_NOOP_CALLBACK = "cal:noop";
export const BACK_TO_SERVICES_CALLBACK = "back:services";

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const DAYS_AHEAD_LIMIT = 90; // максимальный горизонт бронирования

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dateToIso(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

function addDaysUtc(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export type CalendarKeyboardResult = {
  keyboard: InlineKeyboard;
  /** Заголовок вида "Сентябрь 2026" — используется в тексте сообщения. */
  title: string;
};

/**
 * Строит inline-календарь на указанный месяц.
 *
 * Правила:
 *  - неделя начинается с понедельника (российская конвенция);
 *  - даты раньше сегодняшнего дня (UTC) отключены (noop);
 *  - даты дальше today + 90 дней отключены;
 *  - кнопка выбранного ранее дня помечена символом "•";
 *  - навигация "◀️" / "▶️" ограничена горизонтом [today; today+90];
 *  - нижний ряд: «⬅️ Назад» (возврат к выбору услуги).
 */
export function calendarKeyboard(
  year: number,
  monthIndex: number,
  selectedDate: string | null
): CalendarKeyboardResult {
  const today = startOfUtcDay(new Date());
  const maxDate = addDaysUtc(today, DAYS_AHEAD_LIMIT);

  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const jsDay = firstOfMonth.getUTCDay(); // 0 = воскресенье
  const offset = jsDay === 0 ? 6 : jsDay - 1; // сдвиг для начала недели с пн
  const daysInMonth = new Date(
    Date.UTC(year, monthIndex + 1, 0)
  ).getUTCDate();

  const kb = new InlineKeyboard();

  /* -----------------------------------------------------------------
   * 1. Строка навигации: ◀️ Сентябрь 2026 ▶️
   * --------------------------------------------------------------- */
  const prevFirst = new Date(Date.UTC(year, monthIndex - 1, 1));
  const nextFirst = new Date(Date.UTC(year, monthIndex + 1, 1));
  const canGoPrev = addDaysUtc(firstOfMonth, -1) >= today;
  const canGoNext = nextFirst <= maxDate;

  const title = `${MONTHS[monthIndex]} ${year}`;

  kb.text(
    "◀️",
    canGoPrev ? CAL_PREV_CALLBACK : CAL_NOOP_CALLBACK
  );
  kb.text(title, CAL_NOOP_CALLBACK);
  kb.text(
    "▶️",
    canGoNext ? CAL_NEXT_CALLBACK : CAL_NOOP_CALLBACK
  ).row();

  /* -----------------------------------------------------------------
   * 2. Шапка недели: Пн Вт Ср Чт Пт Сб Вс
   * --------------------------------------------------------------- */
  for (const wd of WEEKDAYS_SHORT) {
    kb.text(wd, CAL_NOOP_CALLBACK);
  }
  kb.row();

  /* -----------------------------------------------------------------
   * 3. Сетка дней месяца
   * --------------------------------------------------------------- */
  // Пустые ячейки до первого дня месяца
  for (let i = 0; i < offset; i++) {
    kb.text("·", CAL_NOOP_CALLBACK);
  }

  let cellsInRow = offset;
  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(Date.UTC(year, monthIndex, day));
    const iso = dateToIso(year, monthIndex, day);

    const isPast = cellDate < today;
    const isBeyondHorizon = cellDate > maxDate;
    const isDisabled = isPast || isBeyondHorizon;

    if (isDisabled) {
      kb.text("·", CAL_NOOP_CALLBACK);
    } else {
      const isSelected = selectedDate === iso;
      const label = isSelected ? `•${day}` : String(day);
      kb.text(label, `${DATE_CALLBACK_PREFIX}${iso}`);
    }

    cellsInRow++;
    if (cellsInRow === 7) {
      kb.row();
      cellsInRow = 0;
    }
  }

  // Добить последнюю строку пустышками
  if (cellsInRow !== 0) {
    while (cellsInRow < 7) {
      kb.text("·", CAL_NOOP_CALLBACK);
      cellsInRow++;
    }
    kb.row();
  }

  /* -----------------------------------------------------------------
   * 4. Нижний ряд: назад
   * --------------------------------------------------------------- */
  kb.text("⬅️ Назад", BACK_TO_SERVICES_CALLBACK);

  return { keyboard: kb, title };
}

/**
 * Парсит callback выбора даты.
 * Возвращает "YYYY-MM-DD" или null.
 */
export function parseDateCallback(data: string): string | null {
  if (!data.startsWith(DATE_CALLBACK_PREFIX)) return null;
  const iso = data.slice(DATE_CALLBACK_PREFIX.length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso;
}