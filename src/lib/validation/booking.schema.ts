import { z } from "zod";

/**
 * Формат времени "HH:MM" (24-часовой).
 */
export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ожидается время в формате HH:MM");

/**
 * Формат даты "YYYY-MM-DD".
 * Zod v3.23+ предоставляет z.string().date() — но для совместимости
 * и явного контроля используем regex + refinement.
 */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ожидается дата в формате YYYY-MM-DD")
  .refine(
    (val) => {
      const d = new Date(`${val}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) return false;
      // Проверяем, что дата не «съехала» (например, 2026-02-30 → 2026-03-02)
      const [y, m, day] = val.split("-").map(Number);
      return (
        d.getUTCFullYear() === y &&
        d.getUTCMonth() + 1 === m &&
        d.getUTCDate() === day
      );
    },
    { message: "Некорректная дата" }
  );

/**
 * Телефон: допускает "+", цифры, пробелы, дефисы, скобки.
 * При валидации нормализуем до +<цифры>, длина 9–15.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Укажите телефон")
  .transform((val) => val.replace(/[\s\-()]/g, ""))
  .refine((val) => /^\+?\d{9,15}$/.test(val), {
    message: "Некорректный номер телефона"
  });

/**
 * Источник бронирования.
 */
export const bookingSourceSchema = z.enum(["WEBSITE", "TELEGRAM"]);

/**
 * Статусы брони — на всякий случай используется в PATCH /api/bookings/[id].
 */
export const bookingStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED_BY_CLIENT",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW"
]);

/**
 * Создание брони (POST /api/bookings, а также используется ботом).
 */
export const createBookingSchema = z.object({
  hallId: z.string().min(1, "Не выбран зал"),
  serviceId: z.string().min(1, "Не выбрана услуга"),
  date: dateStringSchema,
  startTime: timeStringSchema,
  clientName: z
    .string()
    .trim()
    .min(2, "Имя минимум 2 символа")
    .max(100, "Имя слишком длинное"),
  clientPhone: phoneSchema,
  source: bookingSourceSchema,
  /**
   * Опциональный Telegram ID клиента. Передаётся ботом, чтобы связывать
   * клиента с его telegramId и дать возможность смотреть свои брони
   * командой /my_bookings.
   */
  telegramId: z.string().min(1).max(100).optional(),
  /**
   * initData из Telegram Mini App. Если передан, сервер проверяет подпись
   * (см. src/lib/telegram-webapp.ts): при валидной подписи источник
   * принудительно становится TELEGRAM, а telegramId берётся из проверенных
   * данных (клиентский telegramId игнорируется).
   */
  telegramInitData: z.string().min(1).max(4096).optional()
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/**
 * Обновление статуса брони (PATCH /api/bookings/[id]).
 */
export const updateBookingStatusSchema = z.object({
  status: bookingStatusSchema
});

export type UpdateBookingStatusInput = z.infer<
  typeof updateBookingStatusSchema
>;

/**
 * Запрос доступности (query-параметры GET /api/availability).
 */
export const availabilityQuerySchema = z.object({
  hallId: z.string().min(1),
  serviceId: z.string().min(1),
  date: dateStringSchema
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

/**
 * Фильтры списка бронирований (GET /api/bookings?…).
 */
export const bookingsFilterSchema = z.object({
  status: bookingStatusSchema.optional(),
  hallId: z.string().min(1).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional()
});

export type BookingsFilter = z.infer<typeof bookingsFilterSchema>;