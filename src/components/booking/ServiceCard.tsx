"use client";

import { IconCheck, IconClock } from "@/components/ui/icons";
import { formatDuration, formatPrice } from "@/lib/format";

export type Service = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  durationMin: number;
};

type ServiceCardProps = {
  service: Service;
  selected: boolean;
  onSelect: (service: Service) => void;
};

export default function ServiceCard({
  service,
  selected,
  onSelect
}: ServiceCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service)}
      className={[
        "group relative flex w-full flex-col rounded-2xl border bg-ink-900 p-5 text-left shadow-soft transition-all duration-200",
        selected
          ? "border-brand-600 ring-2 ring-brand-600/20"
          : "border-ink-800 hover:border-brand-500/50 hover:shadow-lift"
      ].join(" ")}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
              selected
                ? "bg-brand-600 text-white"
                : "bg-brand-500/15 text-brand-300 group-hover:bg-brand-500/25"
            }`}
          >
            <IconClock width={19} height={19} />
          </span>
          <h3 className="pt-1 text-base font-semibold text-white">
            {service.name}
          </h3>
        </div>
      </div>

      {service.description && (
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          {service.description}
        </p>
      )}

      <div className="mt-4 flex items-end justify-between border-t border-ink-800 pt-4">
        <div>
          <div className="text-xl font-semibold tracking-tight text-white">
            {formatPrice(service.price)}{" "}
            <span className="text-sm font-normal text-stone-400">сум</span>
          </div>
          <div className="mt-0.5 text-xs text-stone-400">
            {formatDuration(service.durationMin)}
          </div>
        </div>
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200 ${
            selected
              ? "border-brand-600 bg-brand-600"
              : "border-ink-600 group-hover:border-brand-400"
          }`}
        >
          {selected && (
            <IconCheck width={15} height={15} strokeWidth={3} className="text-white" />
          )}
        </span>
      </div>
    </button>
  );
}