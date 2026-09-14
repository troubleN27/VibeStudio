import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createBookingSchema,
  bookingsFilterSchema
} from "@/lib/validation/booking.schema";
import { createBooking } from "@/lib/booking-service";
import { notifyAdmin, formatBookingNotification } from "@/lib/telegram-notify";
import { dateKeyToUtc } from "@/lib/dates";
import {
  parseJson,
  requireAdmin,
  validate,
  withApiHandler
} from "@/lib/api";

/* =========================================================================
 * GET /api/bookings
 * Админский список броней с фильтрами: ?status=&hallId=&from=&to=
 * ========================================================================= */
export async function GET(req: NextRequest) {
  return withApiHandler(async () => {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const params = validate(
      bookingsFilterSchema,
      {
        status: searchParams.get("status") ?? undefined,
        hallId: searchParams.get("hallId") ?? undefined,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined
      },
      "Некорректные параметры запроса"
    );

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (params.from) dateFilter.gte = dateKeyToUtc(params.from);
    if (params.to) dateFilter.lte = dateKeyToUtc(params.to);

    const bookings = await prisma.booking.findMany({
      where: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.hallId ? { hallId: params.hallId } : {}),
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
  });
}

/* =========================================================================
 * POST /api/bookings
 * Публичное создание брони (сайт + Telegram-бот через общий сервис).
 * После создания — уведомление админу в Telegram.
 * ========================================================================= */
export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    const body = await parseJson(req);
    const data = validate(createBookingSchema, body);

    const booking = await createBooking(data);

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
        source: data.source,
        bookingId: booking.id
      })
    );

    return NextResponse.json(booking, { status: 201 });
  });
}