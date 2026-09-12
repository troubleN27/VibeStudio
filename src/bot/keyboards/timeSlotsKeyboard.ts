import { InlineKeyboard } from "grammy";

/**
 * Callback-префиксы:
 *   - time:<HH:MM>      — выбор времени
 *   - back:dates        — возврат к выбору даты
 *   - back:service      — возврат к выбору услуги (используется только
 *                         при пустом списке слотов, чтобы дать выход)
 */
export const TIME_CALLBACK_PREFIX = "time:";
export const BACK_TO_DATES_CALLBACK = "back:dates";
export const BACK_TO_SERVICE_CALLBACK = "back:service";

/**
 * Строит inline-клавиатуру со свободными стартовыми слотами.
 *
 * Раскладка: 4 кнопки в ряд (обычно 4 × N строк).
 * Пример: 10:00 10:30 11:00 11:30
 *         12:00 12:30 13:00 13:30
 *
 * Если слотов нет — возвращает клавиатуру только с кнопкой «⬅️ Назад»,
 * а сцена selectTime сама покажет текст «Нет свободного времени».
 *
 * @param slots  список "HH:MM" от getAvailability()
 * @param selectedTime  выбранное ранее время (помечается "•") или null
 */
export function timeSlotsKeyboard(
  slots: string[],
  selectedTime: string | null
): InlineKeyboard {
  const kb = new InlineKeyboard();

  const PER_ROW = 4;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const isSelected = selectedTime === slot;
    const label = isSelected ? `•${slot}` : slot;

    kb.text(label, `${TIME_CALLBACK_PREFIX}${slot}`);

    const isLastInRow = (i + 1) % PER_ROW === 0;
    const isLastOverall = i === slots.length - 1;
    if (isLastInRow || isLastOverall) {
      kb.row();
    }
  }

  kb.text("⬅️ Назад", BACK_TO_DATES_CALLBACK);

  return kb;
}

/**
 * Парсит callback выбора времени.
 * Возвращает "HH:MM" или null.
 */
export function parseTimeCallback(data: string): string | null {
  if (!data.startsWith(TIME_CALLBACK_PREFIX)) return null;
  const time = data.slice(TIME_CALLBACK_PREFIX.length);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return time;
}