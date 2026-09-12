"use client";

import { useEffect, useState } from "react";
import {
  IconCalendar,
  IconCheck,
  IconSave
} from "@/components/ui/icons";

export type WorkingHoursRow = {
  dayOfWeek: number; // 0 = воскресенье ... 6 = суббота
  startTime: string; // "10:00"
  endTime: string;   // "22:00"
  enabled: boolean;  // включён ли рабочий день
};

type ScheduleEditorProps = {
  initial: WorkingHoursRow[];
  submitting?: boolean;
  error?: string | null;
  onSave: (rows: WorkingHoursRow[]) => void;
};

const DAY_LABELS = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота"
];

const DAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const DEFAULT_ROW = (day: number): WorkingHoursRow => ({
  dayOfWeek: day,
  startTime: "10:00",
  endTime: "22:00",
  enabled: false
});

// Нормализуем: убедимся, что есть запись на каждый из 7 дней
function normalize(rows: WorkingHoursRow[]): WorkingHoursRow[] {
  const byDay = new Map<number, WorkingHoursRow>();
  for (const r of rows) byDay.set(r.dayOfWeek, r);

  const result: WorkingHoursRow[] = [];
  for (let d = 0; d < 7; d++) {
    const existing = byDay.get(d);
    if (existing) {
      result.push({ ...existing, enabled: true });
    } else {
      result.push(DEFAULT_ROW(d));
    }
  }
  return result;
}

// Порядок отображения: понедельник → воскресенье
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ScheduleEditor({
  initial,
  submitting = false,
  error = null,
  onSave
}: ScheduleEditorProps) {
  const [rows, setRows] = useState<WorkingHoursRow[]>(() =>
    normalize(initial)
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setRows(normalize(initial));
    setValidationError(null);
  }, [initial]);

  function updateRow(day: number, patch: Partial<WorkingHoursRow>) {
    setRows((prev) =>
      prev.map((r) => (r.dayOfWeek === day ? { ...r, ...patch } : r))
    );
    setValidationError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Валидация: в каждом включённом дне start < end
    for (const r of rows) {
      if (!r.enabled) continue;
      if (compareTime(r.startTime, r.endTime) >= 0) {
        setValidationError(
          `В дне "${DAY_LABELS[r.dayOfWeek]}" время начала должно быть раньше времени окончания`
        );
        return;
      }
    }

    const payload = rows.filter((r) => r.enabled);
    onSave(payload);
  }

  const visibleRows = DISPLAY_ORDER.map(
    (d) => rows.find((r) => r.dayOfWeek === d)!
  );

  const enabledCount = rows.filter((r) => r.enabled).length;

  return (
    <form
      onSubmit={handleSubmit}
      className="card overflow-hidden !shadow-lift"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-800 bg-ink-800/50 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-glow">
            <IconCalendar width={19} height={19} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-white">
              Рабочие часы
            </h2>
            <p className="text-xs text-stone-500">
              Выключенный день — выходной
            </p>
          </div>
        </div>
        <span className="pill bg-brand-500/15 text-brand-300">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          {enabledCount} из 7 дней
        </span>
      </div>

      <div className="divide-y divide-ink-800">
        {visibleRows.map((row) => (
          <div
            key={row.dayOfWeek}
            className="flex flex-col gap-3 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <label className="flex cursor-pointer items-center gap-3 sm:w-52">
              <button
                type="button"
                role="switch"
                aria-checked={row.enabled}
                disabled={submitting}
                onClick={() =>
                  updateRow(row.dayOfWeek, { enabled: !row.enabled })
                }
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
                  row.enabled ? "bg-brand-600" : "bg-ink-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-all duration-200 ${
                    row.enabled ? "left-[22px]" : "left-0.5"
                  }`}
                >
                  {row.enabled && (
                    <IconCheck width={11} height={11} strokeWidth={3} className="text-brand-600" />
                  )}
                </span>
              </button>
              <span className="flex items-center gap-2.5">
                <span
                  className={`flex h-7 w-9 items-center justify-center rounded-md text-[11px] font-semibold ${
                    row.enabled
                      ? "bg-brand-500/15 text-brand-300"
                      : "bg-ink-800 text-stone-500"
                  }`}
                >
                  {DAY_SHORT[row.dayOfWeek]}
                </span>
                <span
                  className={`text-sm font-medium ${
                    row.enabled ? "text-white" : "text-stone-500"
                  }`}
                >
                  {DAY_LABELS[row.dayOfWeek]}
                </span>
              </span>
            </label>

            <div className="flex items-center gap-2 pl-14 sm:pl-0">
              <input
                type="time"
                value={row.startTime}
                onChange={(e) =>
                  updateRow(row.dayOfWeek, { startTime: e.target.value })
                }
                className="input !h-9 !w-28"
                disabled={!row.enabled || submitting}
              />
              <span className="text-stone-500">—</span>
              <input
                type="time"
                value={row.endTime}
                onChange={(e) =>
                  updateRow(row.dayOfWeek, { endTime: e.target.value })
                }
                className="input !h-9 !w-28"
                disabled={!row.enabled || submitting}
              />
            </div>
          </div>
        ))}
      </div>

      {(validationError || error) && (
        <div className="alert-error mx-6 mb-2">{validationError ?? error}</div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-ink-800 bg-ink-800/40 px-6 py-4">
        <span className="hidden text-xs text-stone-500 sm:block">
          Изменения применятся ко всем новым бронированиям
        </span>
        <button
          type="submit"
          className="btn-primary"
          disabled={submitting}
        >
          <IconSave width={16} height={16} />
          {submitting ? "Сохраняем..." : "Сохранить расписание"}
        </button>
      </div>
    </form>
  );
}

function compareTime(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah * 60 + am - (bh * 60 + bm);
}