"use client";

import { IconCalendar } from "@/components/ui/icons";

type TimeSlotGridProps = {
  slots: string[]; // ["10:00", "10:30", ...]
  value: string | null;
  onChange: (slot: string) => void;
  loading?: boolean;
};

export default function TimeSlotGrid({
  slots,
  value,
  onChange,
  loading = false
}: TimeSlotGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-11" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="empty !py-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-800 text-stone-400">
          <IconCalendar width={22} height={22} />
        </span>
        <p className="mt-3 text-sm font-medium text-stone-200">
          Нет свободного времени на эту дату
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Попробуйте выбрать другой день
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
      {slots.map((slot) => {
        const selected = value === slot;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onChange(slot)}
            className={[
              "flex h-11 items-center justify-center rounded-xl border text-sm font-medium transition-all duration-150",
              selected
                ? "border-brand-600 bg-brand-600 font-semibold text-white shadow-glow"
                : "border-ink-700 bg-ink-900 text-stone-200 hover:border-brand-500 hover:bg-brand-500/15 hover:text-brand-300"
            ].join(" ")}
            aria-pressed={selected}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}