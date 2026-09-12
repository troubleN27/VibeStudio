import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Клиент не найден"
          }
        },
        { status: 404 }
      );
    }

    const countable = client.bookings.filter(
      (b) => b.status === "CONFIRMED" || b.status === "COMPLETED"
    );

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
  } catch (err) {
    console.error("[GET /api/clients/[id]]", err);
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