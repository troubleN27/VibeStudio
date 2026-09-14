"use client";

import {
  IconCalendar,
  IconCalendarCheck,
  IconChevronDown,
  IconSparkle
} from "@/components/ui/icons";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_STYLES,
  SOURCE_LABELS,
  SOURCE_STYLES,
  type BookingSource,
  type BookingStatus
} from "@/lib/constants";
import { formatPrice } from "@/lib/format";

export type BookingRow = {
  id: string;
  hall: { id: string; name: string };
  service: { id: string; name: string; price: number; durationMin: number };
  client: { id: string; name: string; phone: string };
  date: string; // "YYYY-MM-DD"
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: BookingStatus;
  source: BookingSource;
  createdAt: string;
};

type BookingsTableProps = {
  bookings: BookingRow[];
  loading?: boolean;
  onStatusChange: (id: string, status: BookingStatus) => void;
  updatingId?: string | null;
};

function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "—";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function BookingsTable({
  bookings,
  loading = false,
  onStatusChange,
  updatingId = null
}: BookingsTableProps) {
  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="border-b border-ink-800 px-5 py-4">
          <div className="skeleton h-4 w-40" />
        </div>
        <div className="space-y-0 divide-y divide-ink-800">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-1/3" />
                <div className="skeleton h-3 w-1/4" />
              </div>
              <div className="skeleton h-8 w-28 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="empty !shadow-none">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
          <IconCalendarCheck width={26} height={26} />
        </span>
        <p className="mt-4 text-sm font-medium text-stone-200">
          Бронирований не найдено
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Попробуйте изменить фильтры или период
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
            <IconCalendarCheck width={16} height={16} />
          </span>
          <div>
            <div className="text-sm font-semibold text-white">
              Список броней
            </div>
            <div className="text-xs text-stone-500">
              {bookings.length}{" "}
              {bookings.length === 1 ? "запись" : bookings.length < 5 ? "записи" : "записей"}
            </div>
          </div>
        </div>
        <span
          className={`pill pill-dot ${
            bookings.some((b) => b.status === "PENDING")
              ? "bg-amber-500/15 text-amber-300"
              : "bg-emerald-500/15 text-emerald-300"
          }`}
        >
          {bookings.some((b) => b.status === "PENDING")
            ? "Есть ожидающие"
            : "Всё в порядке"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[920px]">
          <thead>
            <tr>
              <th>Дата / время</th>
              <th>Зал / услуга</th>
              <th>Клиент</th>
              <th className="text-right">Сумма</th>
              <th>Источник</th>
              <th>Статус</th>
              <th className="text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const isUpdating = updatingId === b.id;
              return (
                <tr key={b.id} className={isUpdating ? "bg-ink-800/60" : ""}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-800 text-stone-400">
                        <IconCalendar width={16} height={16} />
                      </span>
                      <div>
                        <div className="font-medium text-white">
                          {formatDate(b.date)}
                        </div>
                        <div className="text-xs text-stone-400">
                          {b.startTime} — {b.endTime}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500/15 text-brand-400">
                        <IconSparkle width={13} height={13} />
                      </span>
                      <div>
                        <div className="font-medium text-white">
                          {b.hall.name}
                        </div>
                        <div className="text-xs text-stone-400">
                          {b.service.name}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ink-800 text-[11px] font-semibold text-stone-300">
                        {initialsOf(b.client.name)}
                      </span>
                      <div>
                        <div className="font-medium text-white">
                          {b.client.name}
                        </div>
                        <div className="text-xs text-stone-400">
                          {b.client.phone}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="text-right">
                    <div className="font-semibold tabular-nums text-white">
                      {formatPrice(b.totalPrice)}{" "}
                      <span className="text-xs font-normal text-stone-500">
                        сум
                      </span>
                    </div>
                  </td>

                  <td>
                    <span className={`pill ring-1 ${SOURCE_STYLES[b.source]}`}>
                      {SOURCE_LABELS[b.source]}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`pill ring-1 ${BOOKING_STATUS_STYLES[b.status]}`}
                    >
                      {BOOKING_STATUS_LABELS[b.status]}
                    </span>
                  </td>

                  <td className="text-right">
                    <div className="relative inline-block">
                      <select
                        value={b.status}
                        disabled={isUpdating}
                        onChange={(e) =>
                          onStatusChange(b.id, e.target.value as BookingStatus)
                        }
                        className="h-9 cursor-pointer appearance-none rounded-lg border border-ink-700 bg-ink-800 pl-3 pr-9 text-xs font-medium text-stone-200 shadow-sm transition hover:border-ink-600 focus:border-brand-500 focus:outline-none disabled:opacity-50"
                      >
                        {(Object.keys(
                          BOOKING_STATUS_LABELS
                        ) as BookingStatus[]).map((status) => (
                          <option key={status} value={status}>
                            {BOOKING_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                      <IconChevronDown
                        width={14}
                        height={14}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500"
                      />
                      {isUpdating && (
                        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-ink-900/70" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}