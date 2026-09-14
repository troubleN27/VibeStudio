import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateHallSchema } from "@/lib/validation/hall.schema";
import { startOfTodayUtc } from "@/lib/dates";
import {
  ApiError,
  isAdmin,
  parseJson,
  requireAdmin,
  validate,
  withApiHandler
} from "@/lib/api";

type RouteContext = {
  params: { id: string };
};

/* =========================================================================
 * GET /api/halls/[id]
 * Публично: активный зал доступен любому; неактивный — только админу.
 * ========================================================================= */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  return withApiHandler(async () => {
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

    if (!hall || (!hall.isActive && !(await isAdmin()))) {
      throw new ApiError(404, "NOT_FOUND", "Зал не найден");
    }

    return NextResponse.json(hall);
  });
}

/* =========================================================================
 * PATCH /api/halls/[id]
 * Только админ: частичное обновление зала.
 * ========================================================================= */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return withApiHandler(async () => {
    await requireAdmin();

    const body = await parseJson(req);
    const data = validate(updateHallSchema, body);

    const existing = await prisma.hall.findUnique({ where: { id: params.id } });
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Зал не найден");
    }

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if ("description" in data) update.description = data.description ?? null;
    if ("photoUrl" in data) update.photoUrl = data.photoUrl ?? null;
    if (data.isActive !== undefined) update.isActive = data.isActive;

    const updated = await prisma.hall.update({
      where: { id: params.id },
      data: update,
      select: {
        id: true,
        name: true,
        description: true,
        photoUrl: true,
        isActive: true
      }
    });

    return NextResponse.json(updated);
  });
}

/* =========================================================================
 * DELETE /api/halls/[id]
 * Только админ: soft-delete (isActive = false).
 * Нельзя удалить зал, если у него есть будущие активные брони.
 * ========================================================================= */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  return withApiHandler(async () => {
    await requireAdmin();

    const hall = await prisma.hall.findUnique({ where: { id: params.id } });
    if (!hall) {
      throw new ApiError(404, "NOT_FOUND", "Зал не найден");
    }

    // Проверка будущих броней — иначе админ должен сначала их отменить
    const futureBookings = await prisma.booking.count({
      where: {
        hallId: params.id,
        date: { gte: startOfTodayUtc() },
        status: { in: ["PENDING", "CONFIRMED"] }
      }
    });

    if (futureBookings > 0) {
      throw new ApiError(
        409,
        "HAS_FUTURE_BOOKINGS",
        `У зала ${futureBookings} активных будущих броней. Сначала отмените или завершите их.`
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
  });
}