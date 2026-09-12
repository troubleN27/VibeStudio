"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconCamera, IconEdit, IconEye, IconEyeOff, IconPlus } from "@/components/ui/icons";
import HallForm, { type HallFormValues } from "@/components/admin/HallForm";

type HallItem = {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  isActive: boolean;
};

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; hall: HallItem };

export default function AdminHallsPage() {
  const [halls, setHalls] = useState<HallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // includeInactive=true поддерживается бэкендом для админа
      const res = await fetch("/api/halls?includeInactive=true");
      if (!res.ok) throw new Error("failed");
      const data: HallItem[] = await res.json();
      setHalls(data);
    } catch {
      setError("Не удалось загрузить список залов");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(values: HallFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        photoUrl: values.photoUrl || undefined
      };

      const isEdit = !!values.id;
      const res = await fetch(
        isEdit ? `/api/halls/${values.id}` : "/api/halls",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit ? { ...payload, isActive: values.isActive } : payload
          )
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось сохранить зал");
        return;
      }

      setMode({ kind: "list" });
      await load();
    } catch {
      setError("Сетевая ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(hall: HallItem) {
    if (
      !confirm(
        `Деактивировать зал "${hall.name}"? Он скроется из публичного выбора, но история броней сохранится.`
      )
    ) {
      return;
    }
    setDeletingId(hall.id);
    setError(null);
    try {
      const res = await fetch(`/api/halls/${hall.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось деактивировать зал");
        return;
      }
      await load();
    } catch {
      setError("Сетевая ошибка");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleActivate(hall: HallItem) {
    setError(null);
    try {
      const res = await fetch(`/api/halls/${hall.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось активировать зал");
        return;
      }
      await load();
    } catch {
      setError("Сетевая ошибка");
    }
  }

  if (mode.kind === "create" || mode.kind === "edit") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setMode({ kind: "list" })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-400 transition-colors hover:text-brand-400"
        >
          <IconArrowLeft width={16} height={16} />
          Назад к списку залов
        </button>
        <HallForm
          initial={
            mode.kind === "edit"
              ? {
                  id: mode.hall.id,
                  name: mode.hall.name,
                  description: mode.hall.description ?? "",
                  photoUrl: mode.hall.photoUrl ?? "",
                  isActive: mode.hall.isActive
                }
              : null
          }
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => setMode({ kind: "list" })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Залы
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Управление пространствами студии. Неактивные залы не видны клиентам.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode({ kind: "create" });
          }}
          className="btn-primary"
        >
          <IconPlus width={16} height={16} />
          Новый зал
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card overflow-hidden p-0">
              <div className="skeleton aspect-[4/3] rounded-none" />
              <div className="space-y-2 p-5">
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : halls.length === 0 ? (
        <div className="empty">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
            <IconCamera width={26} height={26} />
          </span>
          <p className="mt-4 text-sm font-medium text-stone-200">
            Залы ещё не созданы
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Добавьте первый зал, чтобы клиенты могли бронировать
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {halls.map((hall) => (
            <div
              key={hall.id}
              className="card group flex flex-col overflow-hidden p-0 transition-all duration-200 hover:shadow-lift"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-800">
                {hall.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hall.photoUrl}
                    alt={hall.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70">
                      <IconCamera width={20} height={20} />
                    </span>
                  </div>
                )}
                <span
                  className={`pill absolute left-3 top-3 shadow-sm backdrop-blur ${
                    hall.isActive
                      ? "bg-ink-950/80 text-emerald-300 ring-1 ring-emerald-500/30"
                      : "bg-ink-950/70 text-white"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      hall.isActive ? "bg-emerald-400" : "bg-stone-400"
                    }`}
                  />
                  {hall.isActive ? "Активен" : "Скрыт"}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-base font-semibold text-white">
                  {hall.name}
                </h3>
                {hall.description && (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-500">
                    {hall.description}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2 border-t border-ink-800 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode({ kind: "edit", hall });
                    }}
                    className="btn-secondary btn-sm flex-1"
                  >
                    <IconEdit width={14} height={14} />
                    Изменить
                  </button>
                  {hall.isActive ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(hall)}
                      disabled={deletingId === hall.id}
                      className="btn-outline-danger btn-sm"
                    >
                      <IconEyeOff width={14} height={14} className="mr-1" />
                      {deletingId === hall.id ? "..." : "Скрыть"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleActivate(hall)}
                      className="btn-primary btn-sm"
                    >
                      <IconEye width={14} height={14} className="mr-1" />
                      Включить
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}