import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COMMITTED_BOOKING_STATUSES } from "@/lib/constants";
import { ApiError, requireAdmin, withApiHandler } from "@/lib/api";

type RouteContext = {
  params: { id: string };
};

/**
 * GET /api/clients/[id]
 * Только админ: детальная карточка клиента с историей броней.
 *
 * Используется в admin/clients/page.tsx при раскрытии строки —
 * возвращает тот же ClientItem, что и список, плюс массив bookings[].
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  return withApiHandler(async () => {
    await requireAdmin();

    const client = await prisma.client.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        phone: true,
        telegramId: true,
        createdAt: true,
        bookings: {
          orderBy: [{ date: "desc" }, { startTime: "desc" }],
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            totalPrice: true,
            status: true,
            hall: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!client) {
      throw new ApiError(404, "NOT_FOUND", "Клиент не найден");
    }

    const committed = COMMITTED_BOOKING_STATUSES as readonly string[];
    const countable = client.bookings.filter((b) => committed.includes(b.status));

    const totalSpent = countable.reduce(
      (sum, b) => sum + Number(b.totalPrice),
      0
    );

    const lastBookingDate =
      client.bookings.length > 0 ? client.bookings[0].date : null;

    const bookings = client.bookings.map((b) => ({
      id: b.id,
      date: b.date.toISOString().slice(0, 10),
      startTime: b.startTime,
      endTime: b.endTime,
      totalPrice: Number(b.totalPrice),
      status: b.status,
      hall: b.hall,
      service: b.service
    }));

    return NextResponse.json({
      id: client.id,
      name: client.name,
      phone: client.phone,
      telegramId: client.telegramId,
      createdAt: client.createdAt.toISOString(),
      bookingsCount: client.bookings.length,
      totalSpent,
      lastBookingDate: lastBookingDate
        ? lastBookingDate.toISOString().slice(0, 10)
        : null,
      bookings
    });
  });
}