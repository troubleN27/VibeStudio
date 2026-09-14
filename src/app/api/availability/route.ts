import { NextRequest, NextResponse } from "next/server";
import { availabilityQuerySchema } from "@/lib/validation/booking.schema";
import { getAvailability } from "@/lib/booking-service";
import { validate, withApiHandler } from "@/lib/api";

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
  return withApiHandler(async () => {
    const { searchParams } = new URL(req.url);

    const params = validate(
      availabilityQuerySchema,
      {
        hallId: searchParams.get("hallId") ?? undefined,
        serviceId: searchParams.get("serviceId") ?? undefined,
        date: searchParams.get("date") ?? undefined
      },
      "Некорректные параметры запроса"
    );

    const result = await getAvailability(
      params.hallId,
      params.serviceId,
      params.date
    );

    // Кэшируем недолго — слоты могут измениться в любую секунду,
    // поэтому никакого s-maxage, только клиентское «не кэшировать».
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  });
}