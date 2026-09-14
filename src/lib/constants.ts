/**
 * Общие константы и типы предметной области.
 * Чистый модуль (без зависимостей от Prisma/окружения) —
 * можно импортировать и на сервере, и в клиентских компонентах.
 */

export const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED_BY_CLIENT",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW"
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Ожидает",
  CONFIRMED: "Подтверждена",
  COMPLETED: "Завершена",
  CANCELLED_BY_CLIENT: "Отменена клиентом",
  CANCELLED_BY_ADMIN: "Отменена админом",
  NO_SHOW: "Не пришёл"
};

/** Tailwind-классы бейджей статусов в админке. */
export const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  CONFIRMED: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  COMPLETED: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  CANCELLED_BY_CLIENT: "bg-ink-800 text-stone-400 ring-ink-600",
  CANCELLED_BY_ADMIN: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  NO_SHOW: "bg-ink-800 text-stone-500 ring-ink-600"
};

export const BOOKING_SOURCES = ["WEBSITE", "TELEGRAM"] as const;

export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const SOURCE_LABELS: Record<BookingSource, string> = {
  WEBSITE: "Сайт",
  TELEGRAM: "Telegram"
};

/** Tailwind-классы бейджей источника в админке. */
export const SOURCE_STYLES: Record<BookingSource, string> = {
  WEBSITE: "bg-brand-500/15 text-brand-300 ring-brand-500/30",
  TELEGRAM: "bg-sky-500/15 text-sky-300 ring-sky-500/30"
};

/**
 * Статусы, которые считаются «состоявшимися»: учитываются в выручке,
 * утилизации и сумме потраченного клиентом.
 */
export const COMMITTED_BOOKING_STATUSES: readonly BookingStatus[] = [
  "CONFIRMED",
  "COMPLETED"
];