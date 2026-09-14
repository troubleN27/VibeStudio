"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

/** Пустое состояние (список пуст) внутри карточки. */
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  className = ""
}: EmptyStateProps) {
  return (
    <div className={`empty ${className}`}>
      {icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
          {icon}
        </span>
      )}
      <p className="mt-4 text-sm font-medium text-stone-200">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-stone-400">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}