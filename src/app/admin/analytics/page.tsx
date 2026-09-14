"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconCalendar,
  IconChart,
  IconRefresh,
  IconTrending,
  IconWallet
} from "@/components/ui/icons";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { EmptyState } from "@/components/admin/EmptyState";
import { BOOKING_STATUS_LABELS } from "@/lib/constants";
import { currentMonthIsoLocal } from "@/lib/dates";
import { formatPrice } from "@/lib/format";
import { getErrorMessage, requestJson } from "@/lib/client-fetch";

type HallItem = {
  id: string;
  name: string;
};

type AnalyticsResponse = {
  hallId: string;
  period: string;
  totalSlots: number;
  bookedSlots: number;
  utilizationPercent: number;
  revenue?: number;
  statusBreakdown?: Record<string, number>;
};

export default function AdminAnalyticsPage() {
  const [halls, setHalls] = useState<HallItem[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<string>("");
  const [period, setPeriod] = useState<string>(() => currentMonthIsoLocal());

  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHalls = useCallback(async () => {
    const list = await requestJson<HallItem[]>("/api/halls?includeInactive=true");
    setHalls(list);
    if (list.length > 0) {
      setSelectedHallId((prev) => prev || list[0].id);
    }
  }, []);

  useEffect(() => {
    loadHalls().catch(() => {
      setError("Не удалось загрузить список залов");
    });
  }, [loadHalls]);

  const loadAnalytics = useCallback(async () => {
    if (!selectedHallId || !period) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ hallId: selectedHallId, period });
      const body = await requestJson<AnalyticsResponse>(
        `/api/admin/analytics?${params.toString()}`
      );
      setData(body);
    } catch (err) {
      console.error(err);
      setError("Не удалось загрузить аналитику");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedHallId, period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const utilization = data?.utilizationPercent ?? 0;
  const utilizationColor = useMemo(() => {
    if (utilization >= 75) return "text-emerald-400";
    if (utilization >= 40) return "text-brand-300";
    if (utilization > 0) return "text-amber-400";
    return "text-stone-400";
  }, [utilization]);

  const statusEntries = useMemo(() => {
    const breakdown = data?.statusBreakdown ?? {};
    const entries = Object.entries(breakdown);
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return entries
      .map(([status, count]) => ({ status, count, pct: (count / max) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Аналитика"
        subtitle="Загруженность зала, выручка и структура бронирований за период."
      />

      {/* Управление */}
      <div className="card grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="label">Зал</label>
          <select
            value={selectedHallId}
            onChange={(e) => setSelectedHallId(e.target.value)}
            className="input"
            disabled={halls.length === 0}
          >
            {halls.length === 0 ? (
              <option value="">— нет залов —</option>
            ) : (
              halls.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="label">Период</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={loadAnalytics}
            className="btn-primary w-full sm:w-auto"
            disabled={loading || !selectedHallId}
          >
            <IconRefresh width={16} height={16} className={loading ? "animate-spin" : ""} />
            Обновить
          </button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton mt-3 h-8 w-32" />
            </div>
          ))}
        </div>
      ) : !data ? (
        <EmptyState
          icon={<IconChart width={26} height={26} />}
          title={
            halls.length === 0
              ? "Создайте хотя бы один зал в разделе «Залы»"
              : "Выберите зал и период, затем нажмите «Обновить»"
          }
        />
      ) : (
        <>
          {/* Верхние метрики */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Всего слотов"
              value={String(data.totalSlots)}
              hint="доступно в периоде"
              icon={<IconCalendar width={18} height={18} />}
              accent="bg-ink-800 text-stone-300"
            />
            <StatCard
              label="Забронировано"
              value={String(data.bookedSlots)}
              hint="подтв. и завершённые"
              icon={<IconTrending width={18} height={18} />}
              accent="bg-brand-500/15 text-brand-300"
            />
            {data.revenue !== undefined && (
              <StatCard
                label="Выручка за период"
                value={`${formatPrice(data.revenue)} сум`}
                hint="подтв. и завершённые"
                icon={<IconWallet width={18} height={18} />}
                accent="bg-emerald-500/15 text-emerald-400"
              />
            )}
          </div>

          {/* Загруженность: кольцо + разбивка */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card flex items-center gap-6 p-6">
              <Donut
                percent={utilization}
                color={utilization >= 75 ? "#059669" : utilization >= 40 ? "#6941e8" : "#d97706"}
              />
              <div className="min-w-0">
                <div className="text-[13px] text-stone-500">Загруженность зала</div>
                <div className={`text-3xl font-semibold tracking-tight ${utilizationColor}`}>
                  {utilization.toFixed(1)}%
                </div>
                <div className="mt-1 text-xs text-stone-400">
                  {data.bookedSlots} из {data.totalSlots} слотов занято
                </div>
                <div className="mt-3 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, utilization))}%`,
                      background:
                        utilization >= 75 ? "#059669" : utilization >= 40 ? "#6941e8" : "#d97706"
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-base font-semibold text-white">
                Разбивка по статусам
              </h2>
              {statusEntries.length === 0 ? (
                <div className="mt-4 text-sm text-stone-400">
                  Нет данных для отображения
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {statusEntries.map(({ status, count, pct }) => (
                    <li key={status} className="flex items-center gap-3 text-sm">
                      <span className="w-36 flex-shrink-0 truncate text-stone-400">
                        {BOOKING_STATUS_LABELS[status as keyof typeof BOOKING_STATUS_LABELS] ?? status}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 flex-shrink-0 text-right font-semibold tabular-nums text-white">
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Donut({
  percent,
  color
}: {
  percent: number;
  color: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="relative h-32 w-32 flex-shrink-0 rounded-full"
      style={{
        background: `conic-gradient(${color} ${clamped}%, #1a1c24 0)`
      }}
    >
      <div className="absolute inset-2.5 flex flex-col items-center justify-center rounded-full bg-ink-950 shadow-soft">
        <span className="text-2xl font-semibold tracking-tight text-white">
          {clamped.toFixed(0)}%
        </span>
        <span className="text-[10px] text-stone-400">загрузка</span>
      </div>
    </div>
  );
}