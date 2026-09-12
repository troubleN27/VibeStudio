"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCalendarCheck, IconClock, IconFilter, IconRefresh, IconTrending } from "@/components/ui/icons";
import BookingsTable, {
  type BookingRow,
  type BookingStatus
} from "@/components/admin/BookingsTable";

type HallItem = {
  id: string;
  name: string;
};

type FilterStatus = BookingStatus | "";

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "", label: "Все статусы" },
  { value: "PENDING", label: "Ожидает" },
  { value: "CONFIRMED", label: "Подтверждена" },
  { value: "COMPLETED", label: "Завершена" },
  { value: "CANCELLED_BY_CLIENT", label: "Отменена клиентом" },
  { value: "CANCELLED_BY_ADMIN", label: "Отменена админом" },
  { value: "NO_SHOW", label: "Не пришёл" }
];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminBookingsPage() {
  const [halls, setHalls] = useState<HallItem[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("");
  const [filterHallId, setFilterHallId] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>(todayIso());
  const [filterTo, setFilterTo] = useState<string>(addDaysIso(todayIso(), 30));

  const loadHalls = useCallback(async () => {
    try {
      const res = await fetch("/api/halls?includeInactive=true");
      if (!res.ok) return;
      const data: HallItem[] = await res.json();
      setHalls(data);
    } catch {
      // не критично
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterHallId) params.set("hallId", filterHallId);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const res = await fetch(`/api/bookings?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data: BookingRow[] = await res.json();
      setBookings(data);
    } catch {
      setError("Не удалось загрузить бронирования");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterHallId, filterFrom, filterTo]);

  useEffect(() => {
    loadHalls();
  }, [loadHalls]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  async function handleStatusChange(id: string, status: BookingStatus) {
    setUpdatingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось изменить статус");
        return;
      }
      await loadBookings();
    } catch {
      setError("Сетевая ошибка");
    } finally {
      setUpdatingId(null);
    }
  }

  const summary = useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((b) => b.status === "PENDING").length;
    const revenue = bookings
      .filter(
        (b) => b.status === "CONFIRMED" || b.status === "COMPLETED"
      )
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);
    return { total, pending, revenue };
  }, [bookings]);

  function resetFilters() {
    setFilterStatus("");
    setFilterHallId("");
    setFilterFrom(todayIso());
    setFilterTo(addDaysIso(todayIso(), 30));
  }

  const hasActiveFilters = !!(filterStatus || filterHallId);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Бронирования
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Все записи с сайта и Telegram. Меняйте статусы прямо в таблице.
          </p>
        </div>
        <button
          type="button"
          onClick={loadBookings}
          disabled={loading}
          className="btn-secondary"
        >
          <IconRefresh width={16} height={16} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

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
          value={`${new Intl.NumberFormat("ru-RU").format(summary.revenue)} сум`}
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

      <BookingsTable
        bookings={bookings}
        loading={loading}
        updatingId={updatingId}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${accent}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] text-stone-500">{label}</div>
        <div className="truncate text-xl font-semibold tracking-tight text-white">
          {value}
        </div>
      </div>
    </div>
  );
}