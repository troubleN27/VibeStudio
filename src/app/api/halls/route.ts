import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHallSchema } from "@/lib/validation/hall.schema";
import {
  parseJson,
  requireAdmin,
  validate,
  withApiHandler
} from "@/lib/api";

/**
 * GET /api/halls
 * Публичный список активных залов.
 * Для админа (?includeInactive=true, требует сессии) — все залы.
 */
export async function GET(req: NextRequest) {
  return withApiHandler(async () => {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    if (includeInactive) {
      await requireAdmin();
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
  });
}

/**
 * POST /api/halls
 * Создание зала (только админ).
 */
export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    await requireAdmin();

    const body = await parseJson(req);
    const data = validate(createHallSchema, body);

    const hall = await prisma.hall.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        photoUrl: data.photoUrl ?? null,
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
  });
}