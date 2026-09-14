import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  InvalidSlotError,
  NotFoundError,
  SlotUnavailableError
} from "@/lib/booking-service";

/**
 * Общие хелперы для API-роутов: единый формат ошибок
 * `{ error: { code, message, details? } }`, проверка админ-сессии,
 * парсинг JSON-тела, валидация Zod и обёртка маппинга ошибок.
 */

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function apiErrorBody(
  code: string,
  message: string,
  details?: unknown
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {})
    }
  };
}

/** Явная ошибка API — придаёт ответ nextResponse из withApiHandler. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toResponse(): NextResponse {
    return NextResponse.json(apiErrorBody(this.code, this.message, this.details), {
      status: this.status
    });
  }
}

/** true, если запрос выполняется администратором. */
export async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user;
}

/** Требует админ-сессию; иначе бросает ApiError(401). */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new ApiError(401, "UNAUTHORIZED", "Требуется авторизация");
  }
}

/**
 * Читает и парсит JSON-тело запроса.
 * При некорректном теле бросает ApiError(400, VALIDATION_ERROR).
 */
export async function parseJson<T = unknown>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Некорректное тело запроса");
  }
}

/**
 * Валидирует данные схемой Zod. При ошибке бросает
 * ApiError(400, VALIDATION_ERROR, message, flatten()).
 *
 * @param message сообщение для разных контекстов:
 *                «Некорректные данные» (тело) или
 *                «Некорректные параметры запроса» (query).
 */
export function validate<T>(
  schema: z.ZodType<T>,
  data: unknown,
  message = "Некорректные данные"
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", message, parsed.error.flatten());
  }
  return parsed.data;
}

/**
 * Оборачивает обработчик роута: маппит ApiError и доменные ошибки
 * booking-service в единый JSON-формат ошибки, а неизвестные ошибки — в 500.
 */
export function withApiHandler(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  return handler().catch((err: unknown) => {
    if (err instanceof ApiError) {
      return err.toResponse();
    }

    if (err instanceof NotFoundError) {
      return NextResponse.json(
        apiErrorBody(err.code, err.message),
        { status: 404 }
      );
    }
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json(
        apiErrorBody(err.code, err.message),
        { status: 409 }
      );
    }
    if (err instanceof InvalidSlotError) {
      return NextResponse.json(
        apiErrorBody(err.code, err.message),
        { status: 400 }
      );
    }

    console.error("[api] Unhandled error", err);
    return NextResponse.json(
      apiErrorBody("INTERNAL_ERROR", "Внутренняя ошибка сервера"),
      { status: 500 }
    );
  });
}