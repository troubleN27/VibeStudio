import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/* =========================================================================
 * Zod-схемы (локальные, специфичны для этого эндпоинта)
 * ========================================================================= */

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createBlockedSlotSchema = z
  .object({
    hallId: z.string().min(1, "Не выбран зал"),
    date: z
      .string()
      .regex(dateRegex, "Ожидается дата YYYY-MM-DD")
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
      .union([z.string().regex(timeRegex, "Ожидается HH:MM"), z.null()])
      .optional(),
    endTime: z
      .union([z.string().regex(timeRegex, "Ожидается HH:MM"), z.null()])
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
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Требуется авторизация"
          }
        },
        { status: 401 }
      );
    }

    const hallId = req.nextUrl.searchParams.get("hallId");
    if (!hallId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Не указан hallId"
          }
        },
        { status: 400 }
      );
    }

    const hall = await prisma.hall.findUnique({
      where: { id: hallId },
      select: { id: true }
    });
    if (!hall) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Зал не найден"
          }
        },
        { status: 404 }
      );
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

    const serialized = rows.map((r) => ({
      id: r.id,
      hallId: r.hallId,
      date: r.date.toISOString().slice(0, 10),
      startTime: r.startTime,
      endTime: r.endTime,
      reason: r.reason
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error("[GET /api/admin/blocked-slots]", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Внутренняя ошибка сервера"
        }
      },
      { status: 500 }
    );
  }
}

/* =========================================================================
 * POST /api/admin/blocked-slots
 * Создание блокировки.
 * Body: { hallId, date, startTime, endTime, reason? }
 * startTime/endTime = null → блокирует весь день.
 * ========================================================================= */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Требуется авторизация"
          }
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Некорректное тело запроса"
          }
        },
        { status: 400 }
      );
    }

    const parsed = createBlockedSlotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Некорректные данные",
            details: parsed.error.flatten()
          }
        },
        { status: 400 }
      );
    }

    const { hallId, date, startTime, endTime, reason } = parsed.data;

    const hall = await prisma.hall.findUnique({
      where: { id: hallId },
      select: { id: true }
    });
    if (!hall) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Зал не найден"
          }
        },
        { status: 404 }
      );
    }

    const dateUtc = new Date(`${date}T00:00:00.000Z`);
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
        return NextResponse.json(
          {
            error: {
              code: "HAS_ACTIVE_BOOKINGS",
              message: `Интервал пересекается с ${conflicts.length} активными бронями. Сначала отмените их.`
            }
          },
          { status: 409 }
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
        return NextResponse.json(
          {
            error: {
              code: "HAS_ACTIVE_BOOKINGS",
              message: `На этот день есть ${anyBookings} активных броней. Сначала отмените их.`
            }
          },
          { status: 409 }
        );
      }
    }

    const created = await prisma.blockedSlot.create({
      data: {
        hallId,
        date: dateUtc,
        startTime: normalizedStart,
        endTime: normalizedEnd,
        reason: reason ?? null
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
  } catch (err) {
    console.error("[POST /api/admin/blocked-slots]", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Внутренняя ошибка сервера"
        }
      },
      { status: 500 }
    );
  }
}

/* =========================================================================
 * DELETE /api/admin/blocked-slots?id=…
 * Удаление блокировки по id.
 * ========================================================================= */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Требуется авторизация"
          }
        },
        { status: 401 }
      );
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Не указан id"
          }
        },
        { status: 400 }
      );
    }

    const existing = await prisma.blockedSlot.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!existing) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Блокировка не найдена"
          }
        },
        { status: 404 }
      );
    }

    await prisma.blockedSlot.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/blocked-slots]", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Внутренняя ошибка сервера"
        }
      },
      { status: 500 }
    );
  }
}

/* =========================================================================
 * Утилиты
 * ========================================================================= */

function compareTime(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah * 60 + am - (bh * 60 + bm);
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}