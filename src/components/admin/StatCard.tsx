"use client";

import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: string;
  hint?: string;
}

/** Статистическая карточка (объединяет MetricCard и StatCard). */
export function StatCard({ label, value, icon, accent, hint }: StatCardProps) {
  return (
    <div className="card flex items-start gap-4 p-5">
      {icon && (
        <span
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
            accent ?? "bg-ink-700/60 text-stone-400"
          }`}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[13px] text-stone-500">{label}</div>
        <div className="truncate text-xl font-semibold tracking-tight text-white">
          {value}
        </div>
        {hint && <div className="mt-0.5 text-xs text-stone-400">{hint}</div>}
      </div>
    </div>
  );
}