import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServiceSchema } from "@/lib/validation/service.schema";
import {
  ApiError,
  parseJson,
  requireAdmin,
  validate,
  withApiHandler
} from "@/lib/api";

/**
 * GET /api/services
 * Публичный список активных услуг (опционально с фильтром ?hallId=…).
 * С ?includeInactive=true (только для админа) — все услуги, включая скрытые.
 */
export async function GET(req: NextRequest) {
  return withApiHandler(async () => {
    const { searchParams } = new URL(req.url);
    const hallId = searchParams.get("hallId") || undefined;
    const includeInactive = searchParams.get("includeInactive") === "true";

    if (includeInactive) {
      await requireAdmin();
    }

    const services = await prisma.service.findMany({
      where: {
        ...(hallId ? { hallId } : {}),
        ...(includeInactive ? {} : { isActive: true })
      },
      orderBy: { createdAt: "asc" },
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

    return NextResponse.json(
      services.map((s) => ({ ...s, price: Number(s.price) }))
    );
  });
}

/**
 * POST /api/services
 * Создание услуги (только админ).
 */
export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    await requireAdmin();

    const body = await parseJson(req);
    const data = validate(createServiceSchema, body);

    // Проверяем, что зал существует
    const hall = await prisma.hall.findUnique({
      where: { id: data.hallId },
      select: { id: true }
    });
    if (!hall) {
      throw new ApiError(400, "HALL_NOT_FOUND", "Указанный зал не существует");
    }

    const service = await prisma.service.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        price: data.price,
        durationMin: data.durationMin,
        hallId: data.hallId,
        isActive: true
      },
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

    return NextResponse.json(
      { ...service, price: Number(service.price) },
      { status: 201 }
    );
  });
}