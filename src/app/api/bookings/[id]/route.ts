import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateBookingStatusSchema } from "@/lib/validation/booking.schema";
import {
  updateBookingStatus,
  NotFoundError
} from "@/lib/booking-service";

type RouteContext = {
  params: { id: string };
};

/* =========================================================================
 * GET /api/bookings/[id]
 * Только админ: получение одной брони с полными данными.
 * ========================================================================= */
export async function GET(_req: NextRequest, { params }: RouteContext) {
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
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Бронирование не найдено"
          }
        },
        { status: 404 }
      );
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
  } catch (err) {
    console.error("[GET /api/bookings/[id]]", err);
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
 * PATCH /api/bookings/[id]
 * Только админ: смена статуса брони.
 * Body: { "status": "CANCELLED_BY_ADMIN" | ... }
 * ========================================================================= */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
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

    const parsed = updateBookingStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Некорректный статус",
            details: parsed.error.flatten()
          }
        },
        { status: 400 }
      );
    }

    const updated = await updateBookingStatus(
      params.id,
      parsed.data.status
    );

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: err.message
          }
        },
        { status: 404 }
      );
    }

    console.error("[PATCH /api/bookings/[id]]", err);
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
 * DELETE /api/bookings/[id]
 * Только админ: мягкая отмена брони (статус CANCELLED_BY_ADMIN).
 * Физического удаления нет — история сохраняется.
 * ========================================================================= */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
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

    const updated = await updateBookingStatus(
      params.id,
      "CANCELLED_BY_ADMIN"
    );

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: err.message
          }
        },
        { status: 404 }
      );
    }

    console.error("[DELETE /api/bookings/[id]]", err);
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