"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  IconBot,
  IconChevronDown,
  IconSearch,
  IconUsers,
  IconWallet
} from "@/components/ui/icons";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { EmptyState } from "@/components/admin/EmptyState";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_STYLES,
  type BookingStatus
} from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { requestJson } from "@/lib/client-fetch";

type ClientBooking = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  hall: { id: string; name: string };
  service: { id: string; name: string };
};

type ClientItem = {
  id: string;
  name: string;
  phone: string;
  telegramId: string | null;
  createdAt: string;
  bookingsCount: number;
  totalSpent: number;
  lastBookingDate: string | null;
  bookings?: ClientBooking[];
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "—";
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<Record<string, ClientBooking[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClients(await requestJson<ClientItem[]>("/api/clients"));
    } catch (err) {
      console.error(err);
      setError("Не удалось загрузить список клиентов");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const totalClients = clients.length;
  const totalRevenue = useMemo(
    () => clients.reduce((sum, c) => sum + Number(c.totalSpent), 0),
    [clients]
  );
  const telegramLinked = useMemo(
    () => clients.filter((c) => c.telegramId).length,
    [clients]
  );

  async function toggleExpand(client: ClientItem) {
    if (expandedId === client.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(client.id);

    if (details[client.id]) return;

    setDetailsLoading(true);
    try {
      const data = await requestJson<ClientItem>(`/api/clients/${client.id}`);
      setDetails((prev) => ({
        ...prev,
        [client.id]: data.bookings ?? []
      }));
    } catch (err) {
      console.error(err);
      setDetails((prev) => ({ ...prev, [client.id]: [] }));
    } finally {
      setDetailsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Клиенты"
        subtitle="База клиентов студии с историей бронирований."
      />

      {/* Метрики */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Всего клиентов"
          value={String(totalClients)}
          icon={<IconUsers width={18} height={18} />}
          accent="bg-brand-500/15 text-brand-300"
        />
        <StatCard
          label="Общая выручка"
          value={`${formatPrice(totalRevenue)} сум`}
          icon={<IconWallet width={18} height={18} />}
          accent="bg-emerald-500/15 text-emerald-400"
        />
        <StatCard
          label="Подключены к Telegram"
          value={String(telegramLinked)}
          icon={<IconBot width={18} height={18} />}
          accent="bg-sky-500/15 text-sky-400"
        />
      </div>

      {/* Поиск */}
      <div className="card max-w-md p-4">
        <label className="label">Поиск клиентов</label>
        <div className="relative">
          <IconSearch
            width={16}
            height={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input !pl-10"
            placeholder="Имя или номер телефона..."
          />
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="card divide-y divide-ink-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-1/3" />
                <div className="skeleton h-3 w-1/4" />
              </div>
              <div className="skeleton h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch width={24} height={24} />}
          title={search ? "По запросу ничего не найдено" : "Клиентов пока нет"}
          subtitle={
            search
              ? "Попробуйте изменить запрос"
              : "Клиенты появятся после первых бронирований"
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Телефон</th>
                  <th>Telegram</th>
                  <th>Броней</th>
                  <th>Потрачено</th>
                  <th>Последняя запись</th>
                  <th className="text-right" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isExpanded = expandedId === c.id;
                  const clientBookings = details[c.id];
                  return (
                    <Fragment key={c.id}>
                      <tr
                        className="cursor-pointer"
                        onClick={() => toggleExpand(c)}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-semibold text-white">
                              {initialsOf(c.name)}
                            </span>
                            <span className="font-medium text-white">
                              {c.name}
                            </span>
                          </div>
                        </td>
                        <td className="text-stone-600">{c.phone}</td>
                        <td>
                          {c.telegramId ? (
                            <span className="pill bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30">
                              <IconBot width={13} height={13} />
                              Подключён
                            </span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                        <td>
                          <span className="font-semibold tabular-nums text-white">
                            {c.bookingsCount}
                          </span>
                        </td>
                        <td>
                          <span className="font-medium tabular-nums text-white">
                            {formatPrice(c.totalSpent)}{" "}
                            <span className="text-xs font-normal text-stone-500">
                              сум
                            </span>
                          </span>
                        </td>
                        <td className="text-stone-500">
                          {c.lastBookingDate
                            ? formatDate(c.lastBookingDate)
                            : "—"}
                        </td>
                        <td className="text-right">
                          <span
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
                              isExpanded
                                ? "rotate-180 bg-brand-500/15 text-brand-300"
                                : "text-stone-400"
                            }`}
                          >
                            <IconChevronDown width={16} height={16} />
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${c.id}-details`}>
                          <td colSpan={7} className="!bg-ink-900/40 !py-0">
                            <div className="px-6 py-5">
                              {detailsLoading && !clientBookings ? (
                                <div className="skeleton h-20 rounded-xl" />
                              ) : !clientBookings || clientBookings.length === 0 ? (
                                <div className="text-sm text-stone-400">
                                  Нет бронирований
                                </div>
                              ) : (
                                <div>
                                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-stone-400">
                                    История броней · {clientBookings.length}
                                  </div>
                                  <ul className="divide-y divide-ink-800 rounded-xl border border-ink-800 bg-ink-900 shadow-soft">
                                    {clientBookings.map((b) => (
                                      <li
                                        key={b.id}
                                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                                      >
                                        <div className="flex items-center gap-3">
                                          <span className="font-medium tabular-nums text-white">
                                            {formatDate(b.date)}
                                          </span>
                                          <span className="text-stone-400">
                                            {b.startTime} — {b.endTime}
                                          </span>
                                        </div>
                                        <div className="text-stone-600">
                                          {b.hall.name} · {b.service.name}
                                        </div>
                                        <span className={`pill ring-1 ${BOOKING_STATUS_STYLES[b.status]}`}>
                                          {BOOKING_STATUS_LABELS[b.status]}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}