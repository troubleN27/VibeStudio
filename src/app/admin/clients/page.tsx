"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  IconBot,
  IconChevronDown,
  IconSearch,
  IconUsers,
  IconWallet
} from "@/components/ui/icons";

type ClientBooking = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "COMPLETED"
    | "CANCELLED_BY_CLIENT"
    | "CANCELLED_BY_ADMIN"
    | "NO_SHOW";
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

const STATUS_LABELS: Record<ClientBooking["status"], string> = {
  PENDING: "Ожидает",
  CONFIRMED: "Подтверждена",
  COMPLETED: "Завершена",
  CANCELLED_BY_CLIENT: "Отменена клиентом",
  CANCELLED_BY_ADMIN: "Отменена админом",
  NO_SHOW: "Не пришёл"
};

const STATUS_STYLES: Record<ClientBooking["status"], string> = {
  PENDING: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  CONFIRMED: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  COMPLETED: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  CANCELLED_BY_CLIENT: "bg-ink-800 text-stone-400 ring-ink-600",
  CANCELLED_BY_ADMIN: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  NO_SHOW: "bg-ink-800 text-stone-500 ring-ink-600"
};

function formatPrice(n: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "decimal",
    maximumFractionDigits: 0
  }).format(n);
}

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
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("failed");
      const data: ClientItem[] = await res.json();
      setClients(data);
    } catch {
      setError("Не удалось загрузить список клиентов");
      setClients([]);
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
      const res = await fetch(`/api/clients/${client.id}`);
      if (!res.ok) throw new Error("failed");
      const data: ClientItem = await res.json();
      setDetails((prev) => ({
        ...prev,
        [client.id]: data.bookings ?? []
      }));
    } catch {
      setDetails((prev) => ({ ...prev, [client.id]: [] }));
    } finally {
      setDetailsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Клиенты
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          База клиентов студии с историей бронирований.
        </p>
      </div>

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
        <div className="empty">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
            <IconSearch width={24} height={24} />
          </span>
          <p className="mt-4 text-sm font-medium text-stone-200">
            {search
              ? "По запросу ничего не найдено"
              : "Клиентов пока нет"}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {search
              ? "Попробуйте изменить запрос"
              : "Клиенты появятся после первых бронирований"}
          </p>
        </div>
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
                                        <span className={`pill ring-1 ${STATUS_STYLES[b.status]}`}>
                                          {STATUS_LABELS[b.status]}
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