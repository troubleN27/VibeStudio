import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/* =========================================================================
 * Валидация (Zod)
 * ========================================================================= */

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const workingHourRowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, "Ожидается время HH:MM"),
  endTime: z.string().regex(timeRegex, "Ожидается время HH:MM")
});

const putScheduleSchema = z.object({
  hallId: z.string().min(1, "Не выбран зал"),
  workingHours: z.array(workingHourRowSchema)
});

/* =========================================================================
 * GET /api/admin/schedule?hallId=…
 * Возвращает расписание рабочих часов для указанного зала.
 * Формат ответа: { hallId, workingHours: [{ dayOfWeek, startTime, endTime }] }
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

    const rows = await prisma.workingHours.findMany({
      where: { hallId },
      orderBy: { dayOfWeek: "asc" },
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true
      }
    });

    return NextResponse.json({
      hallId,
      workingHours: rows
    });
  } catch (err) {
    console.error("[GET /api/admin/schedule]", err);
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
 * PUT /api/admin/schedule
 * Полная замена рабочих часов зала.
 * Body: { hallId, workingHours: [{ dayOfWeek, startTime, endTime }] }
 *
 * Записи, отсутствующие в новом списке, удаляются (соответствующий день
 * становится выходным). Используется транзакция: deleteAll + createMany.
 * ========================================================================= */
export async function PUT(req: NextRequest) {
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

    const parsed = putScheduleSchema.safeParse(body);
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

    const { hallId, workingHours } = parsed.data;

    // Проверяем зал
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

    // Проверяем: start < end в каждом дне
    for (const row of workingHours) {
      if (compareTime(row.startTime, row.endTime) >= 0) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `В дне ${row.dayOfWeek} время начала должно быть раньше окончания`
            }
          },
          { status: 400 }
        );
      }
    }

    // Проверяем отсутствие дубликатов dayOfWeek
    const days = workingHours.map((r) => r.dayOfWeek);
    if (new Set(days).size !== days.length) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Дублирующиеся дни недели в запросе"
          }
        },
        { status: 400 }
      );
    }

    // Транзакция: полностью переписываем расписание
    await prisma.$transaction([
      prisma.workingHours.deleteMany({ where: { hallId } }),
      prisma.workingHours.createMany({
        data: workingHours.map((r) => ({
          hallId,
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime
        }))
      })
    ]);

    const rows = await prisma.workingHours.findMany({
      where: { hallId },
      orderBy: { dayOfWeek: "asc" },
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true
      }
    });

    return NextResponse.json({
      hallId,
      workingHours: rows
    });
  } catch (err) {
    console.error("[PUT /api/admin/schedule]", err);
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