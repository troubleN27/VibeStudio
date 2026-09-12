"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconCalendarOff,
  IconCheck,
  IconPlus,
  IconTrash
} from "@/components/ui/icons";
import ScheduleEditor, {
  type WorkingHoursRow
} from "@/components/admin/ScheduleEditor";

type HallItem = {
  id: string;
  name: string;
  isActive: boolean;
};

type BlockedSlotItem = {
  id: string;
  hallId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
};

type ScheduleResponse = {
  hallId: string;
  workingHours: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
};

export default function AdminSchedulePage() {
  const [halls, setHalls] = useState<HallItem[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<string>("");
  const [workingHours, setWorkingHours] = useState<WorkingHoursRow[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlotItem[]>([]);

  const [loadingHalls, setLoadingHalls] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Форма нового блокирования
  const [blockDate, setBlockDate] = useState<string>("");
  const [blockStart, setBlockStart] = useState<string>("");
  const [blockEnd, setBlockEnd] = useState<string>("");
  const [blockReason, setBlockReason] = useState<string>("");
  const [blockFullDay, setBlockFullDay] = useState<boolean>(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  // Загрузка залов
  useEffect(() => {
    let cancelled = false;
    setLoadingHalls(true);
    fetch("/api/halls?includeInactive=true")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: HallItem[]) => {
        if (cancelled) return;
        setHalls(data);
        if (data.length > 0) setSelectedHallId(data[0].id);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить список залов");
      })
      .finally(() => {
        if (!cancelled) setLoadingHalls(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSchedule = useCallback(async (hallId: string) => {
    setLoadingSchedule(true);
    setScheduleError(null);
    try {
      const res = await fetch(
        `/api/admin/schedule?hallId=${encodeURIComponent(hallId)}`
      );
      if (!res.ok) throw new Error("failed");
      const data: ScheduleResponse = await res.json();
      const rows: WorkingHoursRow[] = data.workingHours.map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime,
        enabled: true
      }));
      setWorkingHours(rows);
    } catch {
      setScheduleError("Не удалось загрузить расписание");
      setWorkingHours([]);
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  const loadBlocked = useCallback(async (hallId: string) => {
    try {
      const res = await fetch(
        `/api/admin/blocked-slots?hallId=${encodeURIComponent(hallId)}`
      );
      if (!res.ok) throw new Error("failed");
      const data: BlockedSlotItem[] = await res.json();
      setBlockedSlots(data);
    } catch {
      setBlockedSlots([]);
    }
  }, []);

  useEffect(() => {
    if (!selectedHallId) return;
    loadSchedule(selectedHallId);
    loadBlocked(selectedHallId);
  }, [selectedHallId, loadSchedule, loadBlocked]);

  async function handleSaveSchedule(rows: WorkingHoursRow[]) {
    setSavingSchedule(true);
    setScheduleError(null);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hallId: selectedHallId,
          workingHours: rows.map((r) => ({
            dayOfWeek: r.dayOfWeek,
            startTime: r.startTime,
            endTime: r.endTime
          }))
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setScheduleError(body?.error?.message ?? "Не удалось сохранить");
        return;
      }

      await loadSchedule(selectedHallId);
    } catch {
      setScheduleError("Сетевая ошибка");
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleAddBlocked(e: React.FormEvent) {
    e.preventDefault();
    setBlockError(null);

    if (!selectedHallId) {
      setBlockError("Выберите зал");
      return;
    }
    if (!blockDate) {
      setBlockError("Укажите дату");
      return;
    }
    if (!blockFullDay) {
      if (!blockStart || !blockEnd) {
        setBlockError("Укажите время начала и окончания");
        return;
      }
      if (compareTime(blockStart, blockEnd) >= 0) {
        setBlockError("Время начала должно быть раньше окончания");
        return;
      }
    }

    setBlockSubmitting(true);
    try {
      const res = await fetch("/api/admin/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hallId: selectedHallId,
          date: blockDate,
          startTime: blockFullDay ? null : blockStart,
          endTime: blockFullDay ? null : blockEnd,
          reason: blockReason.trim() || undefined
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setBlockError(body?.error?.message ?? "Не удалось заблокировать");
        return;
      }

      setBlockDate("");
      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");
      setBlockFullDay(false);
      await loadBlocked(selectedHallId);
    } catch {
      setBlockError("Сетевая ошибка");
    } finally {
      setBlockSubmitting(false);
    }
  }

  async function handleDeleteBlocked(id: string) {
    if (!confirm("Удалить блокировку?")) return;
    try {
      const res = await fetch(`/api/admin/blocked-slots?id=${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        setError("Не удалось удалить блокировку");
        return;
      }
      await loadBlocked(selectedHallId);
    } catch {
      setError("Сетевая ошибка");
    }
  }

  if (loadingHalls) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="card">
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (halls.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Расписание
        </h1>
        <div className="empty">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
            <IconCalendarOff width={26} height={26} />
          </span>
          <p className="mt-4 text-sm font-medium text-stone-200">
            Сначала создайте хотя бы один зал
          </p>
          <p className="mt-1 text-xs text-stone-400">
            Перейдите в раздел «Залы» и добавьте пространство
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Расписание
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Рабочие часы зала и исключения — нерабочие дни и технические перерывы.
        </p>
      </div>

      {/* Выбор зала */}
      <div className="card flex max-w-md items-end gap-3 p-4">
        <div className="flex-1">
          <label className="label">Зал</label>
          <select
            value={selectedHallId}
            onChange={(e) => setSelectedHallId(e.target.value)}
            className="input"
          >
            {halls.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
                {h.isActive ? "" : " (скрыт)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loadingSchedule ? (
        <div className="card">
          <div className="skeleton h-72 rounded-xl" />
        </div>
      ) : (
        <ScheduleEditor
          initial={workingHours}
          submitting={savingSchedule}
          error={scheduleError}
          onSave={handleSaveSchedule}
        />
      )}

      {/* Блокировки */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-ink-800 bg-ink-800/50 px-6 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <IconCalendarOff width={19} height={19} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-white">
              Исключения и нерабочие периоды
            </h2>
            <p className="text-xs text-stone-500">
              Заблокированные даты или часы исчезают из доступного времени
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
          <form
            onSubmit={handleAddBlocked}
            className="rounded-xl border border-ink-800 bg-ink-800/50 p-5"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label">
                  Дата <span className="text-brand-600">*</span>
                </label>
                <input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="input"
                  disabled={blockSubmitting}
                />
              </div>

              <div>
                <label className="label">Начало</label>
                <input
                  type="time"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  className="input"
                  disabled={blockFullDay || blockSubmitting}
                />
              </div>

              <div>
                <label className="label">Окончание</label>
                <input
                  type="time"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  className="input"
                  disabled={blockFullDay || blockSubmitting}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                role="switch"
                aria-checked={blockFullDay}
                disabled={blockSubmitting}
                onClick={() => setBlockFullDay((v) => !v)}
                className="flex items-center gap-3 text-sm text-stone-400"
              >
                <span
                  className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ${
                    blockFullDay ? "bg-brand-600" : "bg-ink-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-all duration-200 ${
                      blockFullDay ? "left-[22px]" : "left-0.5"
                    }`}
                  >
                    {blockFullDay && (
                      <IconCheck width={11} height={11} strokeWidth={3} className="text-brand-600" />
                    )}
                  </span>
                </span>
                Весь день
              </button>

              <div className="min-w-[220px] flex-1">
                <label className="label">Причина</label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="input"
                  placeholder="Например, техническое обслуживание"
                  disabled={blockSubmitting}
                />
              </div>
            </div>

            {blockError && <div className="alert-error mt-4">{blockError}</div>}

            <div className="mt-5 flex justify-end">
              <button type="submit" className="btn-primary" disabled={blockSubmitting}>
                <IconPlus width={16} height={16} />
                {blockSubmitting ? "Сохраняем..." : "Заблокировать"}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-stone-400">
              Текущие блокировки · {blockedSlots.length}
            </div>
            {blockedSlots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-700 bg-ink-900/40 px-4 py-6 text-center text-sm text-stone-400">
                Блокировок нет — выбранные даты полностью открыты
              </div>
            ) : (
              <ul className="divide-y divide-ink-800 overflow-hidden rounded-xl border border-ink-800">
                {blockedSlots.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-ink-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
                        <IconCalendarOff width={16} height={16} />
                      </span>
                      <div>
                        <div className="font-medium text-white">
                          {formatDate(b.date)}{" "}
                          <span className="font-normal text-stone-400">
                            {b.startTime && b.endTime
                              ? `${b.startTime} — ${b.endTime}`
                              : "весь день"}
                          </span>
                        </div>
                        {b.reason && (
                          <div className="text-xs text-stone-400">{b.reason}</div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlocked(b.id)}
                      className="btn-ghost-danger btn-sm"
                    >
                      <IconTrash width={14} height={14} />
                      Удалить
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function compareTime(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah * 60 + am - (bh * 60 + bm);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}