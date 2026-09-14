"use client";

/**
 * Клиентский хелпер над fetch для запросов к собственному API.
 * - парсит JSON только при успешном статусе;
 * - при ошибке пробрасывает ClientRequestError с текстом из
 *   `{ error: { message } }` (единый формат API-роутов).
 */
export class ClientRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ClientRequestError";
    this.status = status;
  }
}

export async function requestJson<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message =
      (body as { error?: { message?: string } } | null)?.error?.message ??
      `Запрос не выполнен (${res.status})`;
    throw new ClientRequestError(message, res.status);
  }

  return res.json() as Promise<T>;
}

/** Человекочитаемое сообщение: текст серверной ошибки или «Сетевая ошибка». */
export function getErrorMessage(err: unknown): string {
  return err instanceof ClientRequestError
    ? err.message
    : "Сетевая ошибка";
}

/** JSON-тело для мутаций. */
export function jsonBody(data: unknown): string {
  return JSON.stringify(data);
}