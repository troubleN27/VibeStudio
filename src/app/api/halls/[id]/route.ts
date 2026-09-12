import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateHallSchema } from "@/lib/validation/hall.schema";

type RouteContext = {
  params: { id: string };
};

/* =========================================================================
 * GET /api/halls/[id]
 * Публично: активный зал доступен любому; неактивный — только админу.
 * ========================================================================= */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const hall = await prisma.hall.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        description: true,
        photoUrl: true,
        isActive: true
      }
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

    if (!hall.isActive) {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
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
    }

    return NextResponse.json(hall);
  } catch (err) {
    console.error("[GET /api/halls/[id]]", err);
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
 * PATCH /api/halls/[id]
 * Только админ: частичное обновление зала.
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

    const parsed = updateHallSchema.safeParse(body);
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

    const existing = await prisma.hall.findUnique({
      where: { id: params.id }
    });
    if (!existing) {
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

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if ("description" in parsed.data)
      data.description = parsed.data.description ?? null;
    if ("photoUrl" in parsed.data)
      data.photoUrl = parsed.data.photoUrl ?? null;
    if (parsed.data.isActive !== undefined)
      data.isActive = parsed.data.isActive;

    const updated = await prisma.hall.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        photoUrl: true,
        isActive: true
      }
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/halls/[id]]", err);
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
 * DELETE /api/halls/[id]
 * Только админ: soft-delete (isActive = false).
 * Нельзя удалить зал, если у него есть будущие активные брони.
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

    const hall = await prisma.hall.findUnique({
      where: { id: params.id }
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

    // Проверка будущих броней — иначе админ должен сначала их отменить
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    const futureBookings = await prisma.booking.count({
      where: {
        hallId: params.id,
        date: { gte: todayUtc },
        status: { in: ["PENDING", "CONFIRMED"] }
      }
    });

    if (futureBookings > 0) {
      return NextResponse.json(
        {
          error: {
            code: "HAS_FUTURE_BOOKINGS",
            message: `У зала ${futureBookings} активных будущих броней. Сначала отмените или завершите их.`
          }
        },
        { status: 409 }
      );
    }

    const updated = await prisma.hall.update({
      where: { id: params.id },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        description: true,
        photoUrl: true,
        isActive: true
      }
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[DELETE /api/halls/[id]]", err);
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