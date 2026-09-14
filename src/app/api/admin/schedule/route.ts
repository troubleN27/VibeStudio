import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TIME_RE, compareTime } from "@/lib/dates";
import {
  ApiError,
  parseJson,
  requireAdmin,
  validate,
  withApiHandler
} from "@/lib/api";

/* =========================================================================
 * Валидация (Zod)
 * ========================================================================= */

const workingHourRowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(TIME_RE, "Ожидается время HH:MM"),
  endTime: z.string().regex(TIME_RE, "Ожидается время HH:MM")
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
  });
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
  return withApiHandler(async () => {
    await requireAdmin();

    const body = await parseJson(req);
    const data = validate(putScheduleSchema, body);

    const { hallId, workingHours } = data;

    // Проверяем зал
    const hall = await prisma.hall.findUnique({
      where: { id: hallId },
      select: { id: true }
    });
    if (!hall) {
      throw new ApiError(404, "NOT_FOUND", "Зал не найден");
    }

    // Проверяем: start < end в каждом дне
    for (const row of workingHours) {
      if (compareTime(row.startTime, row.endTime) >= 0) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          `В дне ${row.dayOfWeek} время начала должно быть раньше окончания`
        );
      }
    }

    // Проверяем отсутствие дубликатов dayOfWeek
    const days = workingHours.map((r) => r.dayOfWeek);
    if (new Set(days).size !== days.length) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Дублирующиеся дни недели в запросе"
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
  });
}