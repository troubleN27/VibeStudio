import { NextRequest, NextResponse } from "next/server";
import { availabilityQuerySchema } from "@/lib/validation/booking.schema";
import { getAvailability } from "@/lib/booking-service";
import { NotFoundError } from "@/lib/booking-service";

/**
 * GET /api/availability?hallId=…&serviceId=…&date=YYYY-MM-DD
 *
 * Публичный эндпоинт: возвращает свободные стартовые слоты на дату
 * с учётом рабочих часов, блокировок и уже существующих броней.
 *
 * Ответ:
 *   { "date": "2026-09-20", "slots": ["10:00", "10:30", ...] }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const parsed = availabilityQuerySchema.safeParse({
      hallId: searchParams.get("hallId") ?? undefined,
      serviceId: searchParams.get("serviceId") ?? undefined,
      date: searchParams.get("date") ?? undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Некорректные параметры запроса",
            details: parsed.error.flatten()
          }
        },
        { status: 400 }
      );
    }

    const { hallId, serviceId, date } = parsed.data;

    const result = await getAvailability(hallId, serviceId, date);

    // Кэшируем недолго — слоты могут измениться в любую секунду,
    // поэтому никакого s-maxage, только клиентское «не кэшировать».
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: err.message
          }
        },
        { status: 404 }
      );
    }

    console.error("[GET /api/availability]", err);
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