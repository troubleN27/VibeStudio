import type { Context, SessionFlavor } from "grammy";

/**
 * Шаги диалога бота (state machine из SPEC, раздел 7).
 * Соответствуют экранам, между которыми перемещается пользователь.
 */
export type BotStep =
  | "idle"
  | "select_hall"
  | "select_service"
  | "select_date"
  | "select_time"
  | "enter_name"
  | "enter_phone"
  | "confirm";

/**
 * Данные сессии одного пользователя Telegram.
 * Хранятся in-memory через session() middleware Grammy.
 *
 * Все поля опциональны — заполняются по мере продвижения по сценарию.
 * При выходе из сценария (успешная бронь или /cancel) сессия сбрасывается
 * в initialSession().
 */
export interface BotSessionData {
  step: BotStep;

  // Выбранный зал
  hallId?: string;
  hallName?: string;

  // Выбранная услуга
  serviceId?: string;
  serviceName?: string;
  serviceDurationMin?: number;
  servicePrice?: number;

  // Дата в формате "YYYY-MM-DD" (UTC-полночь соответствует Booking.date)
  date?: string;

  // Время старта "HH:MM"
  startTime?: string;

  // Контактные данные
  clientName?: string;
  clientPhone?: string;

  // Состояние календаря (какой месяц сейчас показан)
  calendarYear?: number;
  calendarMonth?: number; // 0 = январь ... 11 = декабрь
}

/**
 * Контекст Grammy с session.
 * Используется во всех сценах бота.
 */
export type BotContext = Context & SessionFlavor<BotSessionData>;

/**
 * Начальное (пустое) состояние сессии.
 */
export function initialSession(): BotSessionData {
  return { step: "idle" };
}

/**
 * Очищает все поля, кроме step, и переводит диалог в idle.
 * Возвращает новый объект — не мутирует переданный.
 */
export function resetSessionData(
  _current: BotSessionData
): BotSessionData {
  return { step: "idle" };
}

/**
 * Утилита: проверяет, что на текущем шаге собраны все обязательные поля
 * для перехода к подтверждению.
 */
export function isReadyToConfirm(session: BotSessionData): boolean {
  return !!(
    session.hallId &&
    session.serviceId &&
    session.date &&
    session.startTime &&
    session.clientName &&
    session.clientPhone
  );
}