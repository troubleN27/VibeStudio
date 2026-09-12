import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      const countable = c.bookings.filter(
        (b) => b.status === "CONFIRMED" || b.status === "COMPLETED"
      );

      const totalSpent = countable.reduce(
        (sum, b) => sum + Number(b.totalPrice),
        0
      );

      const lastBookingDate =
        c.bookings.length > 0
          ? c.bookings.reduce((max, b) => (b.date > max ? b.date : max), c.bookings[0].date)
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
  } catch (err) {
    console.error("[GET /api/clients]", err);
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