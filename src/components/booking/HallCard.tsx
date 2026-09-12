"use client";

import { IconCamera, IconCheck } from "@/components/ui/icons";

export type Hall = {
  id: string;
  name: string;
  description?: string | null;
  photoUrl?: string | null;
};

type HallCardProps = {
  hall: Hall;
  selected: boolean;
  onSelect: (hall: Hall) => void;
};

function initialsOf(name: string) {
  const chars = name.trim().slice(0, 2).toUpperCase();
  return chars || "VS";
}

export default function HallCard({ hall, selected, onSelect }: HallCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(hall)}
      className={[
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-ink-900 text-left shadow-soft transition-all duration-200",
        selected
          ? "border-brand-600 ring-2 ring-brand-600/20"
          : "border-ink-800 hover:border-brand-500/50 hover:shadow-lift"
      ].join(" ")}
      aria-pressed={selected}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-800">
        {hall.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hall.photoUrl}
            alt={hall.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80">
              <IconCamera width={20} height={20} />
            </span>
            <span className="absolute bottom-2.5 right-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {initialsOf(hall.name)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/40 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {selected && (
          <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white shadow-glow">
            <IconCheck width={15} height={15} strokeWidth={2.5} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold text-white">{hall.name}</h3>
        {hall.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-500">
            {hall.description}
          </p>
        )}
        <span
          className={[
            "mt-4 inline-flex w-fit items-center gap-2 text-xs font-medium transition-colors",
            selected ? "text-brand-300" : "text-stone-400 group-hover:text-brand-300"
          ].join(" ")}
        >
          <span
            className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-colors ${
              selected
                ? "border-brand-600 bg-brand-600"
                : "border-ink-600 group-hover:border-brand-400"
            }`}
          >
            {selected && (
              <IconCheck width={11} height={11} strokeWidth={3} className="text-white" />
            )}
          </span>
          {selected ? "Выбран" : "Выбрать зал"}
        </span>
      </div>
    </button>
  );
}