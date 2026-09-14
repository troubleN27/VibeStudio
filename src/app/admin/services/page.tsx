"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconClock,
  IconEdit,
  IconEyeOff,
  IconEye,
  IconPlus,
  IconSave,
  IconSparkle
} from "@/components/ui/icons";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { formatDuration, formatPrice, pluralRu } from "@/lib/format";
import { getErrorMessage, requestJson } from "@/lib/client-fetch";
import { useFetchData } from "@/hooks/useFetchData";

type HallItem = {
  id: string;
  name: string;
  isActive: boolean;
};

type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMin: number;
  hallId: string;
  hall: { id: string; name: string };
  isActive: boolean;
};

type FormState = {
  id?: string;
  name: string;
  description: string;
  price: string;
  durationMin: string;
  hallId: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  price: "",
  durationMin: "60",
  hallId: ""
};

type Mode = { kind: "list" } | { kind: "form"; initial: FormState };

export default function AdminServicesPage() {
  const [halls, setHalls] = useState<HallItem[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterHallId, setFilterHallId] = useState<string>("");

  const loadAll = useCallback(async () => {
    const [hallsData, servicesData] = await Promise.all([
      requestJson<HallItem[]>("/api/halls?includeInactive=true"),
      requestJson<ServiceItem[]>("/api/services?includeInactive=true")
    ]);
    setHalls(hallsData);
    return servicesData;
  }, []);

  const {
    data,
    loading,
    error: loadError,
    reload
  } = useFetchData(loadAll, "Не удалось загрузить данные");

  const services = data ?? [];

  useEffect(() => {
    reload();
  }, [reload]);

  const visibleServices = useMemo(() => {
    if (!filterHallId) return services;
    return services.filter((s) => s.hallId === filterHallId);
  }, [services, filterHallId]);

  function openCreate() {
    setFormError(null);
    setMode({
      kind: "form",
      initial: { ...EMPTY_FORM, hallId: halls[0]?.id ?? "" }
    });
  }

  function openEdit(service: ServiceItem) {
    setFormError(null);
    setMode({
      kind: "form",
      initial: {
        id: service.id,
        name: service.name,
        description: service.description ?? "",
        price: String(service.price),
        durationMin: String(service.durationMin),
        hallId: service.hallId
      }
    });
  }

  function updateForm(patch: Partial<FormState>) {
    if (mode.kind !== "form") return;
    setMode({ kind: "form", initial: { ...mode.initial, ...patch } });
  }

  async function handleSubmit(values: FormState) {
    setSubmitting(true);
    setFormError(null);

    const priceNum = Number(values.price);
    const durationNum = Number(values.durationMin);

    if (values.name.trim().length < 2) {
      setFormError("Название минимум 2 символа");
      setSubmitting(false);
      return;
    }
    if (!values.hallId) {
      setFormError("Выберите зал");
      setSubmitting(false);
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setFormError("Цена должна быть положительным числом");
      setSubmitting(false);
      return;
    }
    if (
      !Number.isInteger(durationNum) ||
      durationNum <= 0 ||
      durationNum > 1440
    ) {
      setFormError("Длительность — целое число от 1 до 1440 минут");
      setSubmitting(false);
      return;
    }

    try {
      const isEdit = !!values.id;
      await requestJson(
        isEdit ? `/api/services/${values.id}` : "/api/services",
        {
          method: isEdit ? "PATCH" : "POST",
          body: JSON.stringify({
            name: values.name.trim(),
            description: values.description.trim() || undefined,
            price: priceNum,
            durationMin: durationNum,
            hallId: values.hallId
          })
        }
      );

      setMode({ kind: "list" });
      await reload();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(service: ServiceItem) {
    if (
      !confirm(
        `Деактивировать услугу "${service.name}"? Она скроется из публичного выбора.`
      )
    ) {
      return;
    }
    setDeletingId(service.id);
    setError(null);
    try {
      await requestJson(`/api/services/${service.id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleActivate(service: ServiceItem) {
    setError(null);
    try {
      await requestJson(`/api/services/${service.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true })
      });
      await reload();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (mode.kind === "form") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setMode({ kind: "list" })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-400 transition-colors hover:text-brand-400"
        >
          <IconArrowLeft width={16} height={16} />
          Назад к списку услуг
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(mode.initial);
          }}
          className="card mx-auto max-w-2xl overflow-hidden !shadow-lift"
        >
          <div className="border-b border-ink-800 bg-ink-800/50 px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-glow">
                <IconSparkle width={19} height={19} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-white">
                  {mode.initial.id ? "Редактировать услугу" : "Новая услуга"}
                </h2>
                <p className="text-xs text-stone-500">
                  Услуга, доступная для бронирования в зале
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div>
              <label className="label">
                Название <span className="text-brand-600">*</span>
              </label>
              <input
                type="text"
                value={mode.initial.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                className="input"
                placeholder="Например, «Фотосессия 1 час»"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="label">
                Зал <span className="text-brand-600">*</span>
              </label>
              <select
                value={mode.initial.hallId}
                onChange={(e) => updateForm({ hallId: e.target.value })}
                className="input"
                disabled={submitting}
              >
                <option value="">— выберите зал —</option>
                {halls.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                    {h.isActive ? "" : " (скрыт)"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Описание</label>
              <textarea
                value={mode.initial.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                className="input min-h-[88px]"
                placeholder="Короткое описание того, что входит в услугу..."
                disabled={submitting}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">
                  Цена (сум) <span className="text-brand-600">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={mode.initial.price}
                  onChange={(e) => updateForm({ price: e.target.value })}
                  className="input"
                  placeholder="250000"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="label">
                  Длительность (минут) <span className="text-brand-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  value={mode.initial.durationMin}
                  onChange={(e) => updateForm({ durationMin: e.target.value })}
                  className="input"
                  placeholder="60"
                  disabled={submitting}
                />
              </div>
            </div>

            {formError && <div className="alert-error">{formError}</div>}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-ink-800 bg-ink-800/40 px-6 py-4">
            <button
              type="button"
              onClick={() => setMode({ kind: "list" })}
              className="btn-ghost"
              disabled={submitting}
            >
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <IconSave width={16} height={16} />
              {submitting ? "Сохраняем..." : "Сохранить услугу"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Услуги"
        subtitle="Что клиенты могут забронировать в каждом зале."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary"
            disabled={halls.length === 0}
            title={halls.length === 0 ? "Сначала создайте хотя бы один зал" : ""}
          >
            <IconPlus width={16} height={16} />
            Новая услуга
          </button>
        }
      />

      {halls.length > 0 && (
        <div className="card flex max-w-md items-end gap-3 p-4">
          <div className="flex-1">
            <label className="label">Фильтр по залу</label>
            <select
              value={filterHallId}
              onChange={(e) => setFilterHallId(e.target.value)}
              className="input"
            >
              <option value="">Все залы</option>
              {halls.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <span className="pill mb-0.5 bg-ink-800 text-stone-400">
            {visibleServices.length}{" "}
            {pluralRu(visibleServices.length, ["услуга", "услуги", "услуг"])}
          </span>
        </div>
      )}

      {(loadError || error) && (
        <div className="alert-error">{loadError ?? error}</div>
      )}

      {loading ? (
        <div className="card divide-y divide-ink-800">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="skeleton h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-1/3" />
                <div className="skeleton h-3 w-1/4" />
              </div>
              <div className="skeleton h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      ) : halls.length === 0 ? (
        <EmptyState
          title="Сначала создайте зал в разделе «Залы»"
          action={
            <Link href="/admin/halls" className="btn-secondary btn-sm">
              Перейти к залам
            </Link>
          }
        />
      ) : visibleServices.length === 0 ? (
        <EmptyState
          icon={<IconSparkle width={26} height={26} />}
          title="Услуг пока нет"
          subtitle="Нажмите «Новая услуга», чтобы добавить"
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[820px]">
              <thead>
                <tr>
                  <th>Услуга</th>
                  <th>Зал</th>
                  <th>Цена</th>
                  <th>Длительность</th>
                  <th>Статус</th>
                  <th className="text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visibleServices.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
                          <IconClock width={16} height={16} />
                        </span>
                        <div>
                          <div className="font-medium text-white">{s.name}</div>
                          {s.description && (
                            <div className="line-clamp-1 text-xs text-stone-500">
                              {s.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-stone-500">{s.hall.name}</td>
                    <td>
                      <div className="font-medium tabular-nums text-white">
                        {formatPrice(s.price)}{" "}
                        <span className="text-xs font-normal text-stone-500">
                          сум
                        </span>
                      </div>
                    </td>
                    <td className="text-stone-500">
                      {formatDuration(s.durationMin)}
                    </td>
                    <td>
                      <span
                        className={`pill ring-1 ${
                          s.isActive
                            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                            : "bg-ink-800 text-stone-400 ring-ink-600"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            s.isActive ? "bg-emerald-400" : "bg-stone-500"
                          }`}
                        />
                        {s.isActive ? "Активна" : "Скрыта"}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="btn-secondary btn-sm"
                        >
                          <IconEdit width={13} height={13} />
                          Изменить
                        </button>
                        {s.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
                            disabled={deletingId === s.id}
                            className="btn-ghost-danger btn-sm"
                          >
                            <IconEyeOff width={13} height={13} />
                            {deletingId === s.id ? "..." : "Скрыть"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleActivate(s)}
                            className="btn-primary btn-sm"
                          >
                            <IconEye width={13} height={13} />
                            Включить
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}