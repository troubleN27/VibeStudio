"use client";

import { useCallback, useState } from "react";

/**
 * Загрузка данных с API для клиентских страниц.
 *
 * Возвращает:
 *  - data     — последние успешно загруженные данные (при ошибке данные
 *               НЕ сбрасываются, остаётся предыдущее значение);
 *  - loading  — true перед запуском запроса;
 *  - error    — текст ошибки (или null);
 *  - reload   — повторный запрос с текущим fetcher'ом;
 *  - setData  — ручная установка данных (например, после локальной мутации).
 */
export function useFetchData<T>(
  fetcher: () => Promise<T>,
  errorMessage: string
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch (err) {
      console.error("[useFetchData]", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetcher, errorMessage]);

  return { data, loading, error, reload, setData };
}