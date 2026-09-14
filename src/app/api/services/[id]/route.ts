import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateServiceSchema } from "@/lib/validation/service.schema";
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
 * GET /api/services/[id]
 * Публично: активная услуга доступна любому; скрытая — только админу.
 * ========================================================================= */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  return withApiHandler(async () => {
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

    if (!service || (!service.isActive && !(await isAdmin()))) {
      throw new ApiError(404, "NOT_FOUND", "Услуга не найдена");
    }

    return NextResponse.json({
      ...service,
      price: Number(service.price)
    });
  });
}

/* =========================================================================
 * PATCH /api/services/[id]
 * Только админ: частичное обновление услуги.
 * ========================================================================= */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return withApiHandler(async () => {
    await requireAdmin();

    const body = await parseJson(req);
    const data = validate(updateServiceSchema, body);

    const existing = await prisma.service.findUnique({
      where: { id: params.id }
    });
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Услуга не найдена");
    }

    // Если меняется hallId — проверяем, что новый зал существует
    if (data.hallId !== undefined && data.hallId !== existing.hallId) {
      const hall = await prisma.hall.findUnique({
        where: { id: data.hallId },
        select: { id: true }
      });
      if (!hall) {
        throw new ApiError(400, "HALL_NOT_FOUND", "Указанный зал не существует");
      }
    }

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if ("description" in data) update.description = data.description ?? null;
    if (data.price !== undefined) update.price = data.price;
    if (data.durationMin !== undefined) update.durationMin = data.durationMin;
    if (data.hallId !== undefined) update.hallId = data.hallId;
    if (data.isActive !== undefined) update.isActive = data.isActive;

    const updated = await prisma.service.update({
      where: { id: params.id },
      data: update,
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
  });
}

/* =========================================================================
 * DELETE /api/services/[id]
 * Только админ: soft-delete (isActive = false).
 * Нельзя деактивировать услугу с будущими активными бронями.
 * ========================================================================= */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  return withApiHandler(async () => {
    await requireAdmin();

    const service = await prisma.service.findUnique({
      where: { id: params.id }
    });
    if (!service) {
      throw new ApiError(404, "NOT_FOUND", "Услуга не найдена");
    }

    // Проверка будущих броней
    const futureBookings = await prisma.booking.count({
      where: {
        serviceId: params.id,
        date: { gte: startOfTodayUtc() },
        status: { in: ["PENDING", "CONFIRMED"] }
      }
    });

    if (futureBookings > 0) {
      throw new ApiError(
        409,
        "HAS_FUTURE_BOOKINGS",
        `У услуги ${futureBookings} активных будущих броней. Сначала отмените или завершите их.`
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
  });
}