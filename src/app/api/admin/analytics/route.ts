import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COMMITTED_BOOKING_STATUSES } from "@/lib/constants";
import { timeToMinutes } from "@/lib/dates";
import { ApiError, requireAdmin, withApiHandler } from "@/lib/api";

/* =========================================================================
 * Константы
 * ========================================================================= */

const SLOT_STEP_MIN = 30;
const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

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
  return withApiHandler(async () => {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const hallId = searchParams.get("hallId");
    const period = searchParams.get("period");

    if (!hallId) {
      throw new ApiError(400, "VALIDATION_ERROR", "Не указан hallId");
    }

    if (!period || !PERIOD_REGEX.test(period)) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "period должен быть в формате YYYY-MM"
      );
    }

    const hall = await prisma.hall.findUnique({
      where: { id: hallId },
      select: { id: true, name: true }
    });
    if (!hall) {
      throw new ApiError(404, "NOT_FOUND", "Зал не найден");
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

    const committed = COMMITTED_BOOKING_STATUSES as readonly string[];

    for (const b of bookings) {
      // Разбивка по статусам — по всем броням периода
      statusBreakdown[b.status] = (statusBreakdown[b.status] ?? 0) + 1;

      // Утилизация и выручка — только по «состоявшимся» статусам
      if (committed.includes(b.status)) {
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
  });
}