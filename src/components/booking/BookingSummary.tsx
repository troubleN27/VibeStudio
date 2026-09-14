"use client";

import { useState } from "react";
import type { Hall } from "./HallCard";
import type { Service } from "./ServiceCard";
import { IconShield } from "@/components/ui/icons";
import { formatPrice } from "@/lib/format";
import { addMinutesToTime, formatDateRu } from "@/lib/dates";

type BookingSummaryProps = {
  hall: Hall | null;
  service: Service | null;
  date: string | null;
  startTime: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (data: { clientName: string; clientPhone: string }) => void;
};

const PHONE_REGEX = /^\+?\d{9,15}$/;

/** То же, что и в src/lib/validation/booking.schema.ts (phoneSchema). */
function normalizePhone(value: string): string {
  return value.replace(/[\s\-()]/g, "");
}

export default function BookingSummary({
  hall,
  service,
  date,
  startTime,
  submitting,
  error,
  onSubmit
}: BookingSummaryProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [touched, setTouched] = useState(false);

  const endTime =
    startTime && service ? addMinutesToTime(startTime, service.durationMin) : null;

  const nameError =
    touched && clientName.trim().length < 2
      ? "Укажите имя (минимум 2 символа)"
      : null;
  const phoneError =
    touched && !PHONE_REGEX.test(normalizePhone(clientPhone))
      ? "Введите корректный номер телефона"
      : null;

  const ready = !!(hall && service && date && startTime);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const cleanPhone = normalizePhone(clientPhone);
    if (clientName.trim().length < 2) return;
    if (!PHONE_REGEX.test(cleanPhone)) return;
    if (!ready) return;
    onSubmit({ clientName: clientName.trim(), clientPhone: cleanPhone });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 shadow-lift">
      {/* Шапка */}
      <div className="border-b border-ink-800 bg-ink-800/50 px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-white">
            Ваша бронь
          </h2>
          <span className="pill bg-brand-500/15 text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Без предоплаты
          </span>
        </div>
      </div>

      <div className="px-6 py-5">
        <dl className="space-y-3 text-sm">
          <Row label="Зал" value={hall?.name ?? "—"} empty={!hall} />
          <Row label="Услуга" value={service?.name ?? "—"} empty={!service} />
          <Row
            label="Дата"
            value={date ? formatDateRu(date) : "—"}
            empty={!date}
          />
          <Row
            label="Время"
            value={
              startTime && endTime
                ? `${startTime} — ${endTime}`
                : startTime ?? "—"
            }
            empty={!startTime}
          />
          <Row
            label="Длительность"
            value={service ? `${service.durationMin} мин` : "—"}
            empty={!service}
          />
        </dl>

        <div className="mt-5 flex items-baseline justify-between border-t border-ink-800 pt-4">
          <span className="text-sm text-stone-500">Итого</span>
          <span className="text-2xl font-semibold tracking-tight text-white">
            {service ? `${formatPrice(service.price)}` : "—"}
            {service && (
              <span className="ml-1 text-sm font-normal text-stone-400">
                сум
              </span>
            )}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 border-t border-ink-800 bg-ink-800/40 px-6 py-5">
        <div>
          <label htmlFor="clientName" className="label">
            Ваше имя
          </label>
          <input
            id="clientName"
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Как к вам обращаться"
            className="input"
            autoComplete="name"
            disabled={submitting}
          />
          {nameError && <p className="mt-1.5 text-xs text-rose-400">{nameError}</p>}
        </div>

        <div>
          <label htmlFor="clientPhone" className="label">
            Телефон
          </label>
          <input
            id="clientPhone"
            type="tel"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
            className="input"
            autoComplete="tel"
            disabled={submitting}
          />
          {phoneError && (
            <p className="mt-1.5 text-xs text-rose-400">{phoneError}</p>
          )}
        </div>

        {error && <div className="alert-error">{error}</div>}

        <button
          type="submit"
          disabled={!ready || submitting}
          className={`btn-primary w-full py-3 text-base ${ready ? "" : "opacity-60"}`}
        >
          {submitting ? "Оформляем..." : "Подтвердить бронь"}
        </button>

        {!ready ? (
          <p className="text-center text-xs text-stone-400">
            Выберите зал, услугу, дату и время
          </p>
        ) : (
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-stone-400">
            <IconShield width={13} height={13} className="text-brand-400" />
            Подтверждение придёт мгновенно
          </p>
        )}
      </form>
    </div>
  );
}

function Row({
  label,
  value,
  empty
}: {
  label: string;
  value: string;
  empty?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className={empty ? "text-stone-300" : "text-stone-500"}>{label}</dt>
      <dd
        className={`break-all text-right font-medium ${
          empty ? "text-stone-300" : "text-stone-100"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}