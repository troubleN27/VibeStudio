import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createBookingSchema,
  bookingsFilterSchema
} from "@/lib/validation/booking.schema";
import {
  createBooking,
  SlotUnavailableError,
  NotFoundError,
  InvalidSlotError
} from "@/lib/booking-service";
import { notifyAdmin, formatBookingNotification } from "@/lib/telegram-notify";

/* =========================================================================
 * GET /api/bookings
 * Админский список броней с фильтрами: ?status=&hallId=&from=&to=
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
    const parsed = bookingsFilterSchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      hallId: searchParams.get("hallId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Некорректные параметры запроса",
            details: parsed.error.flatten()
          }
        },
        { status: 400 }
      );
    }

    const { status, hallId, from, to } = parsed.data;

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) dateFilter.lte = new Date(`${to}T00:00:00.000Z`);

    const bookings = await prisma.booking.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(hallId ? { hallId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      include: {
        hall: { select: { id: true, name: true } },
        service: {
          select: { id: true, name: true, price: true, durationMin: true }
        },
        client: { select: { id: true, name: true, phone: true } }
      }
    });

    const serialized = bookings.map((b) => ({
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
      source: b.source,
      createdAt: b.createdAt.toISOString()
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error("[GET /api/bookings]", err);
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
 * POST /api/bookings
 * Публичное создание брони (сайт + Telegram-бот через общий сервис).
 * После создания — уведомление админу в Telegram.
 * ========================================================================= */
export async function POST(req: NextRequest) {
  try {
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

    const parsed = createBookingSchema.safeParse(body);
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

    const booking = await createBooking(parsed.data);

    // Уведомляем админа. Не блокируем ответ клиенту: если Telegram
    // недоступен или не настроен, бронь всё равно создана и клиент
    // получит 201. Ошибка логируется внутри notifyAdmin.
    void notifyAdmin(
      formatBookingNotification({
        hallName: booking.hall.name,
        serviceName: booking.service.name,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        clientName: booking.client.name,
        clientPhone: booking.client.phone,
        totalPrice: booking.totalPrice,
        source: parsed.data.source,
        bookingId: booking.id
      })
    );

    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json(
        {
          error: {
            code: "SLOT_UNAVAILABLE",
            message: err.message
          }
        },
        { status: 409 }
      );
    }

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

    if (err instanceof InvalidSlotError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_SLOT",
            message: err.message
          }
        },
        { status: 400 }
      );
    }

    console.error("[POST /api/bookings]", err);
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