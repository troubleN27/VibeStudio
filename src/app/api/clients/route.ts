import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COMMITTED_BOOKING_STATUSES } from "@/lib/constants";
import { requireAdmin, withApiHandler } from "@/lib/api";

/**
 * GET /api/clients
 * Только админ: список клиентов с агрегированной статистикой.
 *
 * Ответ — массив ClientItem, ровно как ожидает admin/clients/page.tsx:
 *   {
 *     id, name, phone, telegramId, createdAt,
 *     bookingsCount, totalSpent, lastBookingDate
 *   }
 *
 * «Потрачено» считается по статусам CONFIRMED и COMPLETED — то есть
 * по фактически оплаченным/ожидаемым броням. Отменённые не учитываются.
 */
export async function GET() {
  return withApiHandler(async () => {
    await requireAdmin();

    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        telegramId: true,
        createdAt: true,
        bookings: {
          select: {
            totalPrice: true,
            status: true,
            date: true
          }
        }
      }
    });

    const result = clients.map((c) => {
      const committed = (COMMITTED_BOOKING_STATUSES as readonly string[]);
      const countable = c.bookings.filter((b) =>
        committed.includes(b.status)
      );

      const totalSpent = countable.reduce(
        (sum, b) => sum + Number(b.totalPrice),
        0
      );

      const lastBookingDate =
        c.bookings.length > 0
          ? c.bookings.reduce(
              (max, b) => (b.date > max ? b.date : max),
              c.bookings[0].date
            )
          : null;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        telegramId: c.telegramId,
        createdAt: c.createdAt.toISOString(),
        bookingsCount: c.bookings.length,
        totalSpent,
        lastBookingDate: lastBookingDate
          ? lastBookingDate.toISOString().slice(0, 10)
          : null
      };
    });

    return NextResponse.json(result);
  });
}