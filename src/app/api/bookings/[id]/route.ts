import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateBookingStatusSchema } from "@/lib/validation/booking.schema";
import { updateBookingStatus } from "@/lib/booking-service";
import {
  ApiError,
  parseJson,
  requireAdmin,
  validate,
  withApiHandler
} from "@/lib/api";

type RouteContext = {
  params: { id: string };
};

/* =========================================================================
 * GET /api/bookings/[id]
 * Только админ: получение одной брони с полными данными.
 * ========================================================================= */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  return withApiHandler(async () => {
    await requireAdmin();

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        hall: { select: { id: true, name: true } },
        service: {
          select: { id: true, name: true, price: true, durationMin: true }
        },
        client: { select: { id: true, name: true, phone: true } }
      }
    });

    if (!booking) {
      throw new ApiError(404, "NOT_FOUND", "Бронирование не найдено");
    }

    return NextResponse.json({
      id: booking.id,
      hall: booking.hall,
      service: {
        id: booking.service.id,
        name: booking.service.name,
        price: Number(booking.service.price),
        durationMin: booking.service.durationMin
      },
      client: booking.client,
      date: booking.date.toISOString().slice(0, 10),
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: Number(booking.totalPrice),
      status: booking.status,
      source: booking.source,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString()
    });
  });
}

/* =========================================================================
 * PATCH /api/bookings/[id]
 * Только админ: смена статуса брони.
 * Body: { "status": "CANCELLED_BY_ADMIN" | ... }
 * ========================================================================= */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return withApiHandler(async () => {
    await requireAdmin();

    const body = await parseJson(req);
    const data = validate(updateBookingStatusSchema, body, "Некорректный статус");

    const updated = await updateBookingStatus(params.id, data.status);

    return NextResponse.json(updated);
  });
}

/* =========================================================================
 * DELETE /api/bookings/[id]
 * Только админ: мягкая отмена брони (статус CANCELLED_BY_ADMIN).
 * Физического удаления нет — история сохраняется.
 * ========================================================================= */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  return withApiHandler(async () => {
    await requireAdmin();

    const updated = await updateBookingStatus(params.id, "CANCELLED_BY_ADMIN");

    return NextResponse.json(updated);
  });
}