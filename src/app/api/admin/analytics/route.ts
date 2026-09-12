import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/* =========================================================================
 * Константы
 * ========================================================================= */

const SLOT_STEP_MIN = 30;
const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Статусы, которые считаем «состоявшимися» для аналитики. */
const COMMITTED_STATUSES = ["CONFIRMED", "COMPLETED"] as const;

/* =========================================================================
 * GET /api/admin/analytics?hallId=…&period=YYYY-MM
 *
 * Возвращает:
 *   {
 *     hallId,
 *     period: "YYYY-MM",
 *     totalSlots,           — 30-мин слотов в рабочих часах за период
 *     bookedSlots,          — 30-мин слотов, занятых CONFIRMED+COMPLETED
 *     utilizationPercent,   — bookedSlots / totalSlots * 100
 *     revenue,              — сумма totalPrice по CONFIRMED+COMPLETED
 *     statusBreakdown       — { [status]: количество }
 *   }
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

    const { searchParams } = new URL(req.url);
    const hallId = searchParams.get("hallId");
    const period = searchParams.get("period");

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

    if (!period || !PERIOD_REGEX.test(period)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "period должен быть в формате YYYY-MM"
          }
        },
        { status: 400 }
      );
    }

    const hall = await prisma.hall.findUnique({
      where: { id: hallId },
      select: { id: true, name: true }
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

    const [yearStr, monthStr] = period.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1; // 0-based

    // Границы периода (UTC-полночь)
    const startUtc = new Date(Date.UTC(year, monthIndex, 1));
    const lastDayOfMonth = new Date(
      Date.UTC(year, monthIndex + 1, 0)
    ).getUTCDate();
    const endUtc = new Date(Date.UTC(year, monthIndex, lastDayOfMonth));

    /* ---------------------------------------------------------------------
     * 1. totalSlots — сколько 30-мин слотов доступно за период
     *    по рабочим часам зала.
     * ------------------------------------------------------------------- */
    const workingHours = await prisma.workingHours.findMany({
      where: { hallId },
      select: { dayOfWeek: true, startTime: true, endTime: true }
    });
    const whByDay = new Map(
      workingHours.map((w) => [w.dayOfWeek, w] as const)
    );

    let totalSlots = 0;
    for (let d = 1; d <= lastDayOfMonth; d++) {
      const day = new Date(Date.UTC(year, monthIndex, d));
      const wh = whByDay.get(day.getUTCDay());
      if (!wh) continue;
      const open = timeToMinutes(wh.startTime);
      const close = timeToMinutes(wh.endTime);
      if (close > open) {
        totalSlots += Math.floor((close - open) / SLOT_STEP_MIN);
      }
    }

    /* ---------------------------------------------------------------------
     * 2. Все брони за период — для bookedSlots, revenue, statusBreakdown.
     * ------------------------------------------------------------------- */
    const bookings = await prisma.booking.findMany({
      where: {
        hallId,
        date: { gte: startUtc, lte: endUtc }
      },
      select: {
        totalPrice: true,
        status: true,
        service: { select: { durationMin: true } }
      }
    });

    let bookedSlots = 0;
    let revenue = 0;
    const statusBreakdown: Record<string, number> = {};

    for (const b of bookings) {
      // Разбивка по статусам — по всем броням периода
      statusBreakdown[b.status] = (statusBreakdown[b.status] ?? 0) + 1;

      // Утилизация и выручка — только по «состоявшимся» статусам
      if ((COMMITTED_STATUSES as readonly string[]).includes(b.status)) {
        const slots = Math.max(
          1,
          Math.round(b.service.durationMin / SLOT_STEP_MIN)
        );
        bookedSlots += slots;
        revenue += Number(b.totalPrice);
      }
    }

    /* ---------------------------------------------------------------------
     * 3. Утилизация
     * ------------------------------------------------------------------- */
    const utilizationPercent =
      totalSlots > 0
        ? Math.round((bookedSlots / totalSlots) * 1000) / 10
        : 0;

    return NextResponse.json({
      hallId,
      period,
      totalSlots,
      bookedSlots,
      utilizationPercent,
      revenue,
      statusBreakdown
    });
  } catch (err) {
    console.error("[GET /api/admin/analytics]", err);
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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}