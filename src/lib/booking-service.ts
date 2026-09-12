import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { CreateBookingInput } from "./validation/booking.schema";

/* =========================================================================
 * Ошибки
 * ========================================================================= */

export class SlotUnavailableError extends Error {
  code = "SLOT_UNAVAILABLE" as const;
  constructor(message = "Выбранное время уже занято") {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

export class NotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor(message = "Ресурс не найден") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class InvalidSlotError extends Error {
  code = "INVALID_SLOT" as const;
  constructor(message = "Недопустимый слот времени") {
    super(message);
    this.name = "InvalidSlotError";
  }
}

/* =========================================================================
 * Утилиты работы со временем
 * ========================================================================= */

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

/**
 * Приводит "YYYY-MM-DD" к Date в 00:00 UTC.
 * Это «канонический» ключ даты, который пишется в БД (Booking.date, BlockedSlot.date).
 */
export function dateKeyToUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Проверяет пересечение интервалов [aStart, aEnd) и [bStart, bEnd). */
function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/* =========================================================================
 * Генерация слотов
 * ========================================================================= */

type Interval = { start: number; end: number };

const SLOT_STEP_MIN = 30;

type GenerateSlotsArgs = {
  openMin: number;
  closeMin: number;
  durationMin: number;
  excludeIntervals: Interval[];
};

/**
 * Возвращает список стартовых слотов "HH:MM" с шагом 30 минут, таких что
 * интервал [start, start + durationMin) целиком лежит в рабочих часах
 * и не пересекается ни с одним из excluded.
 */
function generateSlots({
  openMin,
  closeMin,
  durationMin,
  excludeIntervals
}: GenerateSlotsArgs): string[] {
  const result: string[] = [];

  for (
    let start = openMin;
    start + durationMin <= closeMin;
    start += SLOT_STEP_MIN
  ) {
    const end = start + durationMin;
    const conflict = excludeIntervals.some((iv) =>
      intervalsOverlap(start, end, iv.start, iv.end)
    );
    if (!conflict) {
      result.push(minutesToTime(start));
    }
  }

  return result;
}

/* =========================================================================
 * getAvailability
 * ========================================================================= */

export type AvailabilityResult = {
  date: string; // "YYYY-MM-DD"
  slots: string[];
};

/**
 * Возвращает доступные стартовые слоты для пары (зал, услуга) на дату.
 *
 * Правила:
 *  - если нет WorkingHours на dayOfWeek — выходной → [];
 *  - если есть BlockedSlot с startTime=null — весь день закрыт → [];
 *  - учитываются подтверждённые/ожидающие брони (PENDING, CONFIRMED);
 *  - учитываются блокировки на конкретные часы;
 *  - шаг сетки — 30 минут, длительность берётся из услуги.
 */
export async function getAvailability(
  hallId: string,
  serviceId: string,
  dateIso: string
): Promise<AvailabilityResult> {
  const dateUtc = dateKeyToUtc(dateIso);
  const dayOfWeek = dateUtc.getUTCDay(); // 0 = воскресенье

  const service = await prisma.service.findFirst({
    where: { id: serviceId, hallId, isActive: true }
  });
  if (!service) {
    throw new NotFoundError("Услуга не найдена или недоступна");
  }

  const workingHours = await prisma.workingHours.findUnique({
    where: { hallId_dayOfWeek: { hallId, dayOfWeek } }
  });
  if (!workingHours) {
    return { date: dateIso, slots: [] };
  }

  const blockedSlots = await prisma.blockedSlot.findMany({
    where: { hallId, date: dateUtc }
  });

  // Блокировка всего дня
  if (blockedSlots.some((b) => b.startTime === null)) {
    return { date: dateIso, slots: [] };
  }

  const existingBookings = await prisma.booking.findMany({
    where: {
      hallId,
      date: dateUtc,
      status: { in: ["PENDING", "CONFIRMED"] }
    },
    select: { startTime: true, endTime: true }
  });

  const excludeIntervals: Interval[] = [
    ...blockedSlots
      .filter((b): b is typeof b & { startTime: string; endTime: string } =>
        b.startTime !== null && b.endTime !== null
      )
      .map((b) => ({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime)
      })),
    ...existingBookings.map((b) => ({
      start: timeToMinutes(b.startTime),
      end: timeToMinutes(b.endTime)
    }))
  ];

  const openMin = timeToMinutes(workingHours.startTime);
  const closeMin = timeToMinutes(workingHours.endTime);

  const slots = generateSlots({
    openMin,
    closeMin,
    durationMin: service.durationMin,
    excludeIntervals
  });

  return { date: dateIso, slots };
}

/* =========================================================================
 * createBooking
 * ========================================================================= */

export type CreatedBooking = {
  id: string;
  hall: { id: string; name: string };
  service: {
    id: string;
    name: string;
    price: number;
    durationMin: number;
  };
  client: { id: string; name: string; phone: string };
  date: string; // "YYYY-MM-DD"
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: string;
  source: string;
};

/**
 * Создаёт бронирование.
 *
 * Защита от гонок: проверка конфликта и создание записи выполняются внутри
 * одной Prisma-транзакции. При конфликте выбрасывается SlotUnavailableError.
 *
 * Также проверяется, что слот находится в пределах рабочих часов и не
 * попадает в блокировки.
 */
export async function createBooking(
  input: CreateBookingInput
): Promise<CreatedBooking> {
  const dateUtc = dateKeyToUtc(input.date);
  const dayOfWeek = dateUtc.getUTCDay();
  const startMin = timeToMinutes(input.startTime);

  return await prisma.$transaction(async (tx) => {
    // 1. Услуга
    const service = await tx.service.findFirst({
      where: {
        id: input.serviceId,
        hallId: input.hallId,
        isActive: true
      }
    });
    if (!service) {
      throw new NotFoundError("Услуга не найдена или недоступна");
    }
    const endMin = startMin + service.durationMin;
    const endTime = minutesToTime(endMin);

    // 2. Рабочие часы
    const workingHours = await tx.workingHours.findUnique({
      where: { hallId_dayOfWeek: { hallId: input.hallId, dayOfWeek } }
    });
    if (!workingHours) {
      throw new InvalidSlotError("В этот день зал не работает");
    }
    const openMin = timeToMinutes(workingHours.startTime);
    const closeMin = timeToMinutes(workingHours.endTime);
    if (startMin < openMin || endMin > closeMin) {
      throw new InvalidSlotError("Время вне рабочих часов");
    }

    // 3. Блокировки
    const blockedSlots = await tx.blockedSlot.findMany({
      where: { hallId: input.hallId, date: dateUtc }
    });
    const blocked = blockedSlots.some((b) => {
      if (b.startTime === null) return true; // весь день
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime!);
      return intervalsOverlap(startMin, endMin, bStart, bEnd);
    });
    if (blocked) {
      throw new InvalidSlotError("Это время заблокировано администратором");
    }

    // 4. Конфликт с существующей бронью (главная защита от гонки)
    const conflict = await tx.booking.findFirst({
      where: {
        hallId: input.hallId,
        date: dateUtc,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { lt: endTime },
        endTime: { gt: input.startTime }
      }
    });
    if (conflict) {
      throw new SlotUnavailableError();
    }

    // 5. Клиент
    // Если передан telegramId — сначала ищем клиента по telegramId,
    // чтобы не упираться в unique-ограничение при смене телефона.
    let client: { id: string; name: string; phone: string };
    const clientByTelegram = input.telegramId
      ? await tx.client.findUnique({
          where: { telegramId: input.telegramId },
          select: { id: true }
        })
      : null;

    if (clientByTelegram) {
      client = await tx.client.update({
        where: { id: clientByTelegram.id },
        data: { name: input.clientName, phone: input.clientPhone },
        select: { id: true, name: true, phone: true }
      });
    } else {
      client = await tx.client.upsert({
        where: { phone: input.clientPhone },
        update: {
          name: input.clientName,
          ...(input.telegramId ? { telegramId: input.telegramId } : {})
        },
        create: {
          name: input.clientName,
          phone: input.clientPhone,
          ...(input.telegramId ? { telegramId: input.telegramId } : {})
        },
        select: { id: true, name: true, phone: true }
      });
    }

    // 6. Создание брони
    const booking = await tx.booking.create({
      data: {
        hallId: input.hallId,
        serviceId: service.id,
        clientId: client.id,
        date: dateUtc,
        startTime: input.startTime,
        endTime,
        totalPrice: service.price,
        status: "CONFIRMED",
        source: input.source
      },
      include: {
        hall: { select: { id: true, name: true } },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            durationMin: true
          }
        },
        client: { select: { id: true, name: true, phone: true } }
      }
    });

    return serializeBooking(booking);
  });
}

/* =========================================================================
 * cancelBooking / смена статуса
 * ========================================================================= */

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED_BY_CLIENT"
  | "CANCELLED_BY_ADMIN"
  | "NO_SHOW";

/**
 * Обновляет статус брони.
 */
export async function updateBookingStatus(
  id: string,
  status: BookingStatus
): Promise<CreatedBooking> {
  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Бронирование не найдено");
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status },
    include: {
      hall: { select: { id: true, name: true } },
      service: {
        select: { id: true, name: true, price: true, durationMin: true }
      },
      client: { select: { id: true, name: true, phone: true } }
    }
  });

  return serializeBooking(updated);
}

/**
 * Отменяет бронь (обёртка над updateBookingStatus).
 */
export async function cancelBooking(
  id: string,
  by: "CLIENT" | "ADMIN"
): Promise<CreatedBooking> {
  return updateBookingStatus(
    id,
    by === "ADMIN" ? "CANCELLED_BY_ADMIN" : "CANCELLED_BY_CLIENT"
  );
}

/* =========================================================================
 * Сериализация (Decimal → number, Date → "YYYY-MM-DD")
 * ========================================================================= */

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    hall: { select: { id: true; name: true } };
    service: {
      select: { id: true; name: true; price: true; durationMin: true };
    };
    client: { select: { id: true; name: true; phone: true } };
  };
}>;

function serializeBooking(b: BookingWithRelations): CreatedBooking {
  return {
    id: b.id,
    hall: b.hall,
    service: {
      id: b.service.id,
      name: b.service.name,
      price: Number(b.service.price),
      durationMin: b.service.durationMin
    },
    client: b.client,
    date: b.date.toISOString().slice(0, 10),
    startTime: b.startTime,
    endTime: b.endTime,
    totalPrice: Number(b.totalPrice),
    status: b.status,
    source: b.source
  };
}