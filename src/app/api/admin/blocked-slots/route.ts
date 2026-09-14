import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  DATE_RE,
  TIME_RE,
  compareTime,
  dateKeyToUtc,
  timeToMinutes
} from "@/lib/dates";
import {
  ApiError,
  parseJson,
  requireAdmin,
  validate,
  withApiHandler
} from "@/lib/api";

/* =========================================================================
 * Zod-схемы (локальные, специфичны для этого эндпоинта)
 * ========================================================================= */

const createBlockedSlotSchema = z
  .object({
    hallId: z.string().min(1, "Не выбран зал"),
    date: z
      .string()
      .regex(DATE_RE, "Ожидается дата YYYY-MM-DD")
      .refine(
        (val) => {
          const d = new Date(`${val}T00:00:00.000Z`);
          if (Number.isNaN(d.getTime())) return false;
          const [y, m, day] = val.split("-").map(Number);
          return (
            d.getUTCFullYear() === y &&
            d.getUTCMonth() + 1 === m &&
            d.getUTCDate() === day
          );
        },
        { message: "Некорректная дата" }
      ),
    startTime: z
      .union([z.string().regex(TIME_RE, "Ожидается HH:MM"), z.null()])
      .optional(),
    endTime: z
      .union([z.string().regex(TIME_RE, "Ожидается HH:MM"), z.null()])
      .optional(),
    reason: z
      .string()
      .trim()
      .max(500, "Слишком длинная причина")
      .transform((val) => (val === "" ? undefined : val))
      .optional()
  })
  .refine(
    (obj) => {
      // Либо оба null/undefined (весь день), либо оба заданы
      const s = obj.startTime ?? null;
      const e = obj.endTime ?? null;
      const bothNull = s === null && e === null;
      const bothSet = typeof s === "string" && typeof e === "string";
      return bothNull || bothSet;
    },
    { message: "Укажите либо обе границы времени, либо ни одну (весь день)" }
  )
  .refine(
    (obj) => {
      if (!obj.startTime || !obj.endTime) return true;
      return compareTime(obj.startTime, obj.endTime) < 0;
    },
    { message: "Время начала должно быть раньше окончания" }
  );

/* =========================================================================
 * GET /api/admin/blocked-slots?hallId=…
 * Список блокировок для зала.
 * ========================================================================= */
export async function GET(req: NextRequest) {
  return withApiHandler(async () => {
    await requireAdmin();

    const hallId = req.nextUrl.searchParams.get("hallId");
    if (!hallId) {
      throw new ApiError(400, "VALIDATION_ERROR", "Не указан hallId");
    }

    const hall = await prisma.hall.findUnique({
      where: { id: hallId },
      select: { id: true }
    });
    if (!hall) {
      throw new ApiError(404, "NOT_FOUND", "Зал не найден");
    }

    const rows = await prisma.blockedSlot.findMany({
      where: { hallId },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        hallId: true,
        date: true,
        startTime: true,
        endTime: true,
        reason: true
      }
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        hallId: r.hallId,
        date: r.date.toISOString().slice(0, 10),
        startTime: r.startTime,
        endTime: r.endTime,
        reason: r.reason
      }))
    );
  });
}

/* =========================================================================
 * POST /api/admin/blocked-slots
 * Создание блокировки.
 * Body: { hallId, date, startTime, endTime, reason? }
 * startTime/endTime = null → блокирует весь день.
 * ========================================================================= */
export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    await requireAdmin();

    const body = await parseJson(req);
    const data = validate(createBlockedSlotSchema, body);

    const { hallId, date, startTime, endTime } = data;

    const hall = await prisma.hall.findUnique({
      where: { id: hallId },
      select: { id: true }
    });
    if (!hall) {
      throw new ApiError(404, "NOT_FOUND", "Зал не найден");
    }

    const dateUtc = dateKeyToUtc(date);
    const normalizedStart =
      startTime === undefined || startTime === null ? null : startTime;
    const normalizedEnd =
      endTime === undefined || endTime === null ? null : endTime;

    // Проверка: не пересекается ли новая блокировка с существующими
    // активными бронями (если это частичная блокировка)
    if (normalizedStart && normalizedEnd) {
      const startMin = timeToMinutes(normalizedStart);
      const endMin = timeToMinutes(normalizedEnd);

      const sameDayBookings = await prisma.booking.findMany({
        where: {
          hallId,
          date: dateUtc,
          status: { in: ["PENDING", "CONFIRMED"] }
        },
        select: { startTime: true, endTime: true }
      });

      const conflicts = sameDayBookings.filter((b) => {
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        return startMin < bEnd && bStart < endMin;
      });

      if (conflicts.length > 0) {
        throw new ApiError(
          409,
          "HAS_ACTIVE_BOOKINGS",
          `Интервал пересекается с ${conflicts.length} активными бронями. Сначала отмените их.`
        );
      }
    } else {
      // Полная блокировка дня — проверяем, нет ли на этот день активных броней
      const anyBookings = await prisma.booking.count({
        where: {
          hallId,
          date: dateUtc,
          status: { in: ["PENDING", "CONFIRMED"] }
        }
      });
      if (anyBookings > 0) {
        throw new ApiError(
          409,
          "HAS_ACTIVE_BOOKINGS",
          `На этот день есть ${anyBookings} активных броней. Сначала отмените их.`
        );
      }
    }

    const created = await prisma.blockedSlot.create({
      data: {
        hallId,
        date: dateUtc,
        startTime: normalizedStart,
        endTime: normalizedEnd,
        reason: data.reason ?? null
      },
      select: {
        id: true,
        hallId: true,
        date: true,
        startTime: true,
        endTime: true,
        reason: true
      }
    });

    return NextResponse.json(
      {
        id: created.id,
        hallId: created.hallId,
        date: created.date.toISOString().slice(0, 10),
        startTime: created.startTime,
        endTime: created.endTime,
        reason: created.reason
      },
      { status: 201 }
    );
  });
}

/* =========================================================================
 * DELETE /api/admin/blocked-slots?id=…
 * Удаление блокировки по id.
 * ========================================================================= */
export async function DELETE(req: NextRequest) {
  return withApiHandler(async () => {
    await requireAdmin();

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      throw new ApiError(400, "VALIDATION_ERROR", "Не указан id");
    }

    const existing = await prisma.blockedSlot.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Блокировка не найдена");
    }

    await prisma.blockedSlot.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  });
}