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
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { compareTime, formatDateRu } from "@/lib/dates";
import { getErrorMessage, requestJson } from "@/lib/client-fetch";

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
    requestJson<HallItem[]>("/api/halls?includeInactive=true")
      .then((data) => {
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
      const data = await requestJson<ScheduleResponse>(
        `/api/admin/schedule?hallId=${encodeURIComponent(hallId)}`
      );
      const rows: WorkingHoursRow[] = data.workingHours.map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime,
        enabled: true
      }));
      setWorkingHours(rows);
    } catch (err) {
      console.error(err);
      setScheduleError("Не удалось загрузить расписание");
      setWorkingHours([]);
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  const loadBlocked = useCallback(async (hallId: string) => {
    try {
      setBlockedSlots(
        await requestJson<BlockedSlotItem[]>(
          `/api/admin/blocked-slots?hallId=${encodeURIComponent(hallId)}`
        )
      );
    } catch (err) {
      console.error(err);
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
      await requestJson("/api/admin/schedule", {
        method: "PUT",
        body: JSON.stringify({
          hallId: selectedHallId,
          workingHours: rows.map((r) => ({
            dayOfWeek: r.dayOfWeek,
            startTime: r.startTime,
            endTime: r.endTime
          }))
        })
      });
      await loadSchedule(selectedHallId);
    } catch (err) {
      setScheduleError(getErrorMessage(err));
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
      await requestJson("/api/admin/blocked-slots", {
        method: "POST",
        body: JSON.stringify({
          hallId: selectedHallId,
          date: blockDate,
          startTime: blockFullDay ? null : blockStart,
          endTime: blockFullDay ? null : blockEnd,
          reason: blockReason.trim() || undefined
        })
      });

      setBlockDate("");
      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");
      setBlockFullDay(false);
      await loadBlocked(selectedHallId);
    } catch (err) {
      setBlockError(getErrorMessage(err));
    } finally {
      setBlockSubmitting(false);
    }
  }

  async function handleDeleteBlocked(id: string) {
    if (!confirm("Удалить блокировку?")) return;
    setError(null);
    try {
      await requestJson(`/api/admin/blocked-slots?id=${id}`, {
        method: "DELETE"
      });
      await loadBlocked(selectedHallId);
    } catch (err) {
      setError(getErrorMessage(err));
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
        <PageHeader title="Расписание" />
        <EmptyState
          icon={<IconCalendarOff width={26} height={26} />}
          title="Сначала создайте хотя бы один зал"
          subtitle="Перейдите в раздел «Залы» и добавьте пространство"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Расписание"
        subtitle="Рабочие часы зала и исключения — нерабочие дни и технические перерывы."
      />

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
                          {formatDateRu(b.date)}{" "}
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