import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateServiceSchema } from "@/lib/validation/service.schema";

type RouteContext = {
  params: { id: string };
};

/* =========================================================================
 * GET /api/services/[id]
 * Публично: активная услуга доступна любому; скрытая — только админу.
 * ========================================================================= */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const service = await prisma.service.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        durationMin: true,
        hallId: true,
        isActive: true,
        hall: { select: { id: true, name: true } }
      }
    });

    if (!service) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Услуга не найдена"
          }
        },
        { status: 404 }
      );
    }

    if (!service.isActive) {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Услуга не найдена"
            }
          },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      ...service,
      price: Number(service.price)
    });
  } catch (err) {
    console.error("[GET /api/services/[id]]", err);
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
 * PATCH /api/services/[id]
 * Только админ: частичное обновление услуги.
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

    const parsed = updateServiceSchema.safeParse(body);
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

    const existing = await prisma.service.findUnique({
      where: { id: params.id }
    });
    if (!existing) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Услуга не найдена"
          }
        },
        { status: 404 }
      );
    }

    // Если меняется hallId — проверяем, что новый зал существует
    if (
      parsed.data.hallId !== undefined &&
      parsed.data.hallId !== existing.hallId
    ) {
      const hall = await prisma.hall.findUnique({
        where: { id: parsed.data.hallId },
        select: { id: true }
      });
      if (!hall) {
        return NextResponse.json(
          {
            error: {
              code: "HALL_NOT_FOUND",
              message: "Указанный зал не существует"
            }
          },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if ("description" in parsed.data)
      data.description = parsed.data.description ?? null;
    if (parsed.data.price !== undefined) data.price = parsed.data.price;
    if (parsed.data.durationMin !== undefined)
      data.durationMin = parsed.data.durationMin;
    if (parsed.data.hallId !== undefined) data.hallId = parsed.data.hallId;
    if (parsed.data.isActive !== undefined)
      data.isActive = parsed.data.isActive;

    const updated = await prisma.service.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        durationMin: true,
        hallId: true,
        isActive: true,
        hall: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json({
      ...updated,
      price: Number(updated.price)
    });
  } catch (err) {
    console.error("[PATCH /api/services/[id]]", err);
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
 * DELETE /api/services/[id]
 * Только админ: soft-delete (isActive = false).
 * Нельзя деактивировать услугу с будущими активными бронями.
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

    const service = await prisma.service.findUnique({
      where: { id: params.id }
    });
    if (!service) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Услуга не найдена"
          }
        },
        { status: 404 }
      );
    }

    // Проверка будущих броней
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    const futureBookings = await prisma.booking.count({
      where: {
        serviceId: params.id,
        date: { gte: todayUtc },
        status: { in: ["PENDING", "CONFIRMED"] }
      }
    });

    if (futureBookings > 0) {
      return NextResponse.json(
        {
          error: {
            code: "HAS_FUTURE_BOOKINGS",
            message: `У услуги ${futureBookings} активных будущих броней. Сначала отмените или завершите их.`
          }
        },
        { status: 409 }
      );
    }

    const updated = await prisma.service.update({
      where: { id: params.id },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        durationMin: true,
        hallId: true,
        isActive: true,
        hall: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json({
      ...updated,
      price: Number(updated.price)
    });
  } catch (err) {
    console.error("[DELETE /api/services/[id]]", err);
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