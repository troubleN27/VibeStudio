"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconCamera, IconEdit, IconEye, IconEyeOff, IconPlus } from "@/components/ui/icons";
import HallForm, { type HallFormValues } from "@/components/admin/HallForm";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { getErrorMessage, requestJson } from "@/lib/client-fetch";
import { useFetchData } from "@/hooks/useFetchData";

type HallItem = {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  isActive: boolean;
};

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; hall: HallItem };

export default function AdminHallsPage() {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    // includeInactive=true поддерживается бэкендом для админа
    return requestJson<HallItem[]>("/api/halls?includeInactive=true");
  }, []);

  const {
    data,
    loading,
    error: loadError,
    reload
  } = useFetchData(load, "Не удалось загрузить список залов");

  const halls = data ?? [];

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleSubmit(values: HallFormValues) {
    setSubmitting(true);
    setActionError(null);
    try {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        photoUrl: values.photoUrl || undefined
      };

      const isEdit = !!values.id;
      await requestJson(
        isEdit ? `/api/halls/${values.id}` : "/api/halls",
        {
          method: isEdit ? "PATCH" : "POST",
          body: JSON.stringify(
            isEdit ? { ...payload, isActive: values.isActive } : payload
          )
        }
      );

      setMode({ kind: "list" });
      await reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
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
    setActionError(null);
    try {
      await requestJson(`/api/halls/${hall.id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleActivate(hall: HallItem) {
    setActionError(null);
    try {
      await requestJson(`/api/halls/${hall.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true })
      });
      await reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
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
          error={actionError}
          onSubmit={handleSubmit}
          onCancel={() => setMode({ kind: "list" })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Залы"
        subtitle="Управление пространствами студии. Неактивные залы не видны клиентам."
        actions={
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setMode({ kind: "create" });
            }}
            className="btn-primary"
          >
            <IconPlus width={16} height={16} />
            Новый зал
          </button>
        }
      />

      {(loadError || actionError) && (
        <div className="alert-error">{loadError ?? actionError}</div>
      )}

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
        <EmptyState
          icon={<IconCamera width={26} height={26} />}
          title="Залы ещё не созданы"
          subtitle="Добавьте первый зал, чтобы клиенты могли бронировать"
        />
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
                      setActionError(null);
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