"use client";

import { useMemo, useState } from "react";
import { IconChevronRight } from "@/components/ui/icons";

type CalendarProps = {
  value: string | null; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  minDate?: string; // "YYYY-MM-DD"
  maxDate?: string; // "YYYY-MM-DD"
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function Calendar({
  value,
  onChange,
  minDate,
  maxDate
}: CalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const min = useMemo(
    () => (minDate ? startOfDay(new Date(minDate)) : today),
    [minDate, today]
  );
  const max = useMemo(
    () => (maxDate ? startOfDay(new Date(maxDate)) : null),
    [maxDate]
  );

  const initial = value ? new Date(value) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const daysGrid = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    // 0 = воскресенье, приводим к понедельнику как началу недели
    const jsDay = firstOfMonth.getDay();
    const offset = jsDay === 0 ? 6 : jsDay - 1;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // Добиваем до полных недель
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  function isDisabled(day: number): boolean {
    const cellDate = startOfDay(new Date(viewYear, viewMonth, day));
    if (cellDate < min) return true;
    if (max && cellDate > max) return true;
    return false;
  }

  function isSelected(day: number): boolean {
    if (!value) return false;
    return value === toIso(viewYear, viewMonth, day);
  }

  function isToday(day: number): boolean {
    const cellDate = startOfDay(new Date(viewYear, viewMonth, day));
    return cellDate.getTime() === today.getTime();
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  const canGoPrev = useMemo(() => {
    const prevLast = new Date(viewYear, viewMonth, 0);
    return prevLast >= min;
  }, [viewYear, viewMonth, min]);

  const canGoNext = useMemo(() => {
    if (!max) return true;
    const nextFirst = new Date(viewYear, viewMonth + 1, 1);
    return nextFirst <= max;
  }, [viewYear, viewMonth, max]);

  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900 p-5 shadow-soft">
      {/* Заголовок */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-700 text-stone-400 transition-all hover:border-ink-600 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Предыдущий месяц"
        >
          <IconChevronRight width={16} height={16} className="rotate-180" />
        </button>
        <div className="text-sm font-semibold text-white">
          {MONTHS[viewMonth]} {viewYear}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          disabled={!canGoNext}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-700 text-stone-400 transition-all hover:border-ink-600 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Следующий месяц"
        >
          <IconChevronRight width={16} height={16} />
        </button>
      </div>

      {/* Дни недели */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-400"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Сетка дней */}
      <div className="grid grid-cols-7 gap-1">
        {daysGrid.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }
          const disabled = isDisabled(day);
          const selected = isSelected(day);
          const today = isToday(day);

          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onChange(toIso(viewYear, viewMonth, day))}
              className={[
                "relative mx-auto flex aspect-square w-full max-w-[44px] items-center justify-center rounded-full text-sm font-medium transition-all duration-150",
                selected
                  ? "bg-brand-600 font-semibold text-white shadow-glow"
                  : disabled
                  ? "cursor-not-allowed text-stone-300"
                  : "text-stone-200 hover:bg-brand-500/15 hover:text-brand-300",
                !selected && today ? "ring-1 ring-inset ring-brand-400" : ""
              ].join(" ")}
            >
              {day}
              {!selected && today && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}