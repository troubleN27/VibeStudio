import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHallSchema } from "@/lib/validation/hall.schema";

/**
 * GET /api/halls
 * Публичный список активных залов.
 * Для админа (?includeInactive=true, требует сессии) — все залы.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

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

    const halls = await prisma.hall.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        photoUrl: true,
        isActive: true
      }
    });

    return NextResponse.json(halls);
  } catch (err) {
    console.error("[GET /api/halls]", err);
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
 * POST /api/halls
 * Создание зала (только админ).
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

    const parsed = createHallSchema.safeParse(body);
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

    const hall = await prisma.hall.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        photoUrl: parsed.data.photoUrl ?? null,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        description: true,
        photoUrl: true,
        isActive: true
      }
    });

    return NextResponse.json(hall, { status: 201 });
  } catch (err) {
    console.error("[POST /api/halls]", err);
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