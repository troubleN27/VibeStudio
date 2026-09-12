import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createServiceSchema } from "@/lib/validation/service.schema";

/**
 * GET /api/services
 * Публичный список активных услуг (опционально с фильтром ?hallId=…).
 * С ?includeInactive=true (только для админа) — все услуги, включая скрытые.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hallId = searchParams.get("hallId") || undefined;
    const includeInactive =
      searchParams.get("includeInactive") === "true";

    if (includeInactive) {
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

    const serialized = services.map((s) => ({
      ...s,
      price: Number(s.price)
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error("[GET /api/services]", err);
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

/**
 * POST /api/services
 * Создание услуги (только админ).
 */
export async function POST(req: NextRequest) {
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

    const parsed = createServiceSchema.safeParse(body);
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

    // Проверяем, что зал существует
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

    const service = await prisma.service.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        price: parsed.data.price,
        durationMin: parsed.data.durationMin,
        hallId: parsed.data.hallId,
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
  } catch (err) {
    console.error("[POST /api/services]", err);
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