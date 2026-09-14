"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCalendarCheck, IconClock, IconFilter, IconRefresh, IconTrending } from "@/components/ui/icons";
import BookingsTable, { type BookingRow } from "@/components/admin/BookingsTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  COMMITTED_BOOKING_STATUSES,
  type BookingStatus
} from "@/lib/constants";
import { addDaysIsoLocal, todayIsoLocal } from "@/lib/dates";
import { formatPrice } from "@/lib/format";
import { getErrorMessage, requestJson } from "@/lib/client-fetch";
import { useFetchData } from "@/hooks/useFetchData";

type HallItem = {
  id: string;
  name: string;
};

type FilterStatus = BookingStatus | "";

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "", label: "Все статусы" },
  ...BOOKING_STATUSES.map((s) => ({
    value: s,
    label: BOOKING_STATUS_LABELS[s]
  }))
];

export default function AdminBookingsPage() {
  const [halls, setHalls] = useState<HallItem[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("");
  const [filterHallId, setFilterHallId] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>(() => todayIsoLocal());
  const [filterTo, setFilterTo] = useState<string>(() =>
    addDaysIsoLocal(todayIsoLocal(), 30)
  );

  const loadHalls = useCallback(async () => {
    setHalls(await requestJson<HallItem[]>("/api/halls?includeInactive=true"));
  }, []);

  useEffect(() => {
    loadHalls().catch(() => {
      // список залов не критичен для работы страницы
    });
  }, [loadHalls]);

  const loadBookings = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterHallId) params.set("hallId", filterHallId);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    return requestJson<BookingRow[]>(`/api/bookings?${params.toString()}`);
  }, [filterStatus, filterHallId, filterFrom, filterTo]);

  const {
    data,
    loading,
    error,
    reload
  } = useFetchData(loadBookings, "Не удалось загрузить бронирования");

  const bookings = data ?? [];

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleStatusChange(id: string, status: BookingStatus) {
    setUpdatingId(id);
    setActionError(null);
    try {
      await requestJson(`/api/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  }

  const summary = useMemo(() => {
    const committed = COMMITTED_BOOKING_STATUSES as readonly string[];
    const total = bookings.length;
    const pending = bookings.filter((b) => b.status === "PENDING").length;
    const revenue = bookings
      .filter((b) => committed.includes(b.status))
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);
    return { total, pending, revenue };
  }, [bookings]);

  function resetFilters() {
    setFilterStatus("");
    setFilterHallId("");
    setFilterFrom(todayIsoLocal());
    setFilterTo(addDaysIsoLocal(todayIsoLocal(), 30));
  }

  const hasActiveFilters = !!(filterStatus || filterHallId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Бронирования"
        subtitle="Все записи с сайта и Telegram. Меняйте статусы прямо в таблице."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="btn-secondary"
          >
            <IconRefresh width={16} height={16} className={loading ? "animate-spin" : ""} />
            Обновить
          </button>
        }
      />

      {/* Статистика периода */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Записей в периоде"
          value={String(summary.total)}
          icon={<IconCalendarCheck width={18} height={18} />}
          accent="bg-brand-500/15 text-brand-300"
        />
        <StatCard
          label="Ожидают подтверждения"
          value={String(summary.pending)}
          icon={<IconClock width={18} height={18} />}
          accent="bg-amber-500/15 text-amber-400"
        />
        <StatCard
          label="Выручка (подтв. + заверш.)"
          value={`${formatPrice(summary.revenue)} сум`}
          icon={<IconTrending width={18} height={18} />}
          accent="bg-emerald-500/15 text-emerald-400"
        />
      </div>

      {/* Фильтры */}
      <div className="card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <IconFilter width={16} height={16} className="text-brand-400" />
          Фильтры
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto text-xs font-medium text-brand-400 hover:text-brand-300"
            >
              Сбросить фильтры
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Статус</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="input"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Зал</label>
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

          <div>
            <label className="label">Дата с</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label">Дата по</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {actionError && <div className="alert-error">{actionError}</div>}

      <BookingsTable
        bookings={bookings}
        loading={loading}
        updatingId={updatingId}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}