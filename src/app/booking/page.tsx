"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconCheckCircle,
  IconCamera
} from "@/components/ui/icons";
import HallCard, { type Hall } from "@/components/booking/HallCard";
import ServiceCard, { type Service } from "@/components/booking/ServiceCard";
import Calendar from "@/components/booking/Calendar";
import TimeSlotGrid from "@/components/booking/TimeSlotGrid";
import BookingSummary from "@/components/booking/BookingSummary";
import { addDaysIsoLocal, formatDateRu, todayIsoLocal } from "@/lib/dates";
import {
  ClientRequestError,
  getErrorMessage,
  requestJson
} from "@/lib/client-fetch";

type AvailabilityResponse = {
  date: string;
  slots: string[];
};

type CreatedBooking = {
  id: string;
  hall: { id: string; name: string };
  service: { id: string; name: string; price: number; durationMin: number };
  date: string;
  startTime: string;
  endTime: string;
  status: string;
};

export default function BookingPage() {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<string[]>([]);

  const [selectedHall, setSelectedHall] = useState<Hall | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [loadingHalls, setLoadingHalls] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreatedBooking | null>(null);

  const minDate = useMemo(() => todayIsoLocal(), []);
  const maxDate = useMemo(() => addDaysIsoLocal(todayIsoLocal(), 90), []);

  const currentStep = useMemo(
    () => (selectedHall ? (selectedService ? (selectedDate ? (selectedTime ? 4 : 3) : 2) : 1) : 0),
    [selectedHall, selectedService, selectedDate, selectedTime]
  );
  const maxStepReached = selectedTime ? 4 : selectedDate ? 3 : selectedService ? 2 : selectedHall ? 1 : 0;

  // Загрузка залов
  useEffect(() => {
    let cancelled = false;
    setLoadingHalls(true);
    requestJson<Hall[]>("/api/halls")
      .then((data) => {
        if (!cancelled) setHalls(data);
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

  // Загрузка услуг при выборе зала
  useEffect(() => {
    if (!selectedHall) {
      setServices([]);
      setSelectedService(null);
      return;
    }
    let cancelled = false;
    setLoadingServices(true);
    setSelectedService(null);
    requestJson<Service[]>(
      `/api/services?hallId=${encodeURIComponent(selectedHall.id)}`
    )
      .then((data) => {
        if (!cancelled) setServices(data);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить услуги");
      })
      .finally(() => {
        if (!cancelled) setLoadingServices(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedHall]);

  // Сброс времени при смене услуги/даты
  useEffect(() => {
    setSelectedTime(null);
  }, [selectedService, selectedDate]);

  const loadAvailability = useCallback(async () => {
    if (!selectedHall || !selectedService || !selectedDate) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        hallId: selectedHall.id,
        serviceId: selectedService.id,
        date: selectedDate
      });
      const res = await fetch(`/api/availability?${params.toString()}`);
      if (!res.ok) throw new Error("availability failed");
      const data: AvailabilityResponse = await res.json();
      setSlots(data.slots);
    } catch {
      setSlots([]);
      setError("Не удалось загрузить доступное время");
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedHall, selectedService, selectedDate]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  async function handleSubmit(data: {
    clientName: string;
    clientPhone: string;
  }) {
    if (!selectedHall || !selectedService || !selectedDate || !selectedTime) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const booking = await requestJson<CreatedBooking>("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hallId: selectedHall.id,
          serviceId: selectedService.id,
          date: selectedDate,
          startTime: selectedTime,
          clientName: data.clientName,
          clientPhone: data.clientPhone,
          source: "WEBSITE"
        })
      });

      setSuccess(booking);
      // Обновляем слоты, чтобы отразить новую занятость
      await loadAvailability();
    } catch (err) {
      if (err instanceof ClientRequestError && err.status === 409) {
        setError("Это время уже занято. Пожалуйста, выберите другое.");
        await loadAvailability();
        setSelectedTime(null);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setSuccess(null);
    setSelectedHall(null);
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTime(null);
  }

  if (success) {
    return (
      <main className="min-h-screen bg-ink-950">
        <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/80 backdrop-blur-xl">
          <div className="container-page flex h-16 items-center justify-between">
            <Link href="/">
              <Logo light />
            </Link>
          </div>
        </header>

        <div className="container-page flex min-h-[75vh] items-center justify-center py-14">
          <div className="w-full max-w-xl animate-scale-in">
            <div className="card overflow-hidden !shadow-lift">
              <div className="relative flex flex-col items-center px-8 pb-10 pt-12 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-8 ring-emerald-500/10">
                  <IconCheckCircle width={40} height={40} strokeWidth={1.6} />
                </span>
                <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Бронь подтверждена!
                </h1>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
                  Мы сохранили вашу запись и отправили подтверждение. Ждём вас
                  в студии.
                </p>
              </div>

              <div className="mx-8 mb-4 overflow-hidden rounded-xl border border-ink-700">
                <div className="border-b border-ink-700 bg-ink-800/60 px-5 py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
                    Номер брони
                  </span>
                  <div className="mt-0.5 font-mono text-lg font-semibold tracking-tight text-brand-300">
                    {success.id}
                  </div>
                </div>
                <dl className="space-y-2.5 px-5 py-4 text-sm">
                  <DetailRow label="Зал" value={success.hall.name} />
                  <DetailRow label="Услуга" value={success.service.name} />
                  <DetailRow label="Дата" value={formatDateRu(success.date)} />
                  <DetailRow
                    label="Время"
                    value={`${success.startTime} — ${success.endTime}`}
                  />
                </dl>
              </div>

              <div className="flex flex-col gap-3 px-8 pb-8 sm:flex-row">
                <button
                  type="button"
                  onClick={resetAll}
                  className="btn-primary flex-1"
                >
                  Забронировать ещё
                </button>
                <Link href="/" className="btn-secondary flex-1">
                  На главную
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/80 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/">
            <Logo light />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-400 transition-colors hover:text-brand-400"
          >
            <IconArrowLeft width={16} height={16} />
            На главную
          </Link>
        </div>
      </header>

      <div className="container-page py-8 lg:py-12">
        {/* Заголовок */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300">
            <span className="h-1 w-1 rounded-full bg-brand-500" />
            Онлайн-бронирование
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Запишитесь на съёмку
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-500">
            Выберите зал, услугу и удобное время — бронь активируется
            мгновенно, без предоплаты.
          </p>
        </div>

        {/* Прогресс шагов */}
        <div className="mt-8 flex max-w-2xl items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const done = maxStepReached > i;
            const active = currentStep <= i && !done;
            return (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={[
                    "flex whitespace-nowrap items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
                    done
                      ? "bg-brand-500/15 text-brand-200"
                      : active
                      ? "bg-white text-ink-950"
                      : "text-stone-400"
                  ].join(" ")}
                >
                  <span
                    className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold ${
                      done
                        ? "bg-brand-600 text-white"
                        : active
                        ? "bg-ink-950 text-white"
                        : "bg-ink-700 text-stone-400"
                    }`}
                  >
                    {done ? (
                      <IconCheck width={11} height={11} strokeWidth={3} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {s}
                </div>
                {i < STEPS.length - 1 && (
                  <span className="h-px w-4 bg-ink-700 sm:w-6" />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-10">
            {/* Шаг 1: Зал */}
            <Section number={1} title="Выберите зал" active={currentStep >= 0}>
              {loadingHalls ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton aspect-[4/3] rounded-2xl" />
                  ))}
                </div>
              ) : halls.length === 0 ? (
                <Empty
                  title="Залы пока недоступны"
                  text="Студия готовится к открытию"
                  icon={<IconCamera width={22} height={22} />}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {halls.map((hall) => (
                    <HallCard
                      key={hall.id}
                      hall={hall}
                      selected={selectedHall?.id === hall.id}
                      onSelect={(h) => {
                        setSelectedHall(h);
                        setSelectedDate(null);
                        setSelectedTime(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Шаг 2: Услуга */}
            {selectedHall && (
              <Section number={2} title="Выберите услугу" active={currentStep >= 1}>
                {loadingServices ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="skeleton h-40 rounded-2xl" />
                    ))}
                  </div>
                ) : services.length === 0 ? (
                  <Empty
                    title="Для этого зала пока нет услуг"
                    text="Загляните позже"
                    icon={<IconCamera width={22} height={22} />}
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {services.map((service) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        selected={selectedService?.id === service.id}
                        onSelect={setSelectedService}
                      />
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* Шаг 3: Дата */}
            {selectedService && (
              <Section number={3} title="Выберите дату" active={currentStep >= 2}>
                <div className="max-w-md">
                  <Calendar
                    value={selectedDate}
                    onChange={setSelectedDate}
                    minDate={minDate}
                    maxDate={maxDate}
                  />
                </div>
              </Section>
            )}

            {/* Шаг 4: Время */}
            {selectedService && selectedDate && (
              <Section number={4} title="Выберите время" active={currentStep >= 3}>
                <div className="max-w-md">
                  <TimeSlotGrid
                    slots={slots}
                    value={selectedTime}
                    onChange={setSelectedTime}
                    loading={loadingSlots}
                  />
                </div>
                {selectedTime && (
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .querySelector<HTMLElement>("#summary")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                      className="btn-primary"
                    >
                      Заполнить контакты
                      <IconArrowRight width={17} height={17} />
                    </button>
                  </div>
                )}
              </Section>
            )}
          </div>

          {/* Сводка */}
          <aside id="summary" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
            <BookingSummary
              hall={selectedHall}
              service={selectedService}
              date={selectedDate}
              startTime={selectedTime}
              submitting={submitting}
              error={error}
              onSubmit={handleSubmit}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

const STEPS = ["Зал", "Услуга", "Дата", "Время"];

function Section({
  number,
  title,
  active = true,
  children
}: {
  number: number;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={active ? "" : "opacity-70"}>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-glow">
          {number}
        </span>
        <h2 className="text-[17px] font-semibold tracking-tight text-white">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Empty({
  title,
  text,
  icon
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-800 text-stone-400">
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium text-stone-200">{title}</p>
      <p className="mt-1 text-xs text-stone-400">{text}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-white">{value}</dd>
    </div>
  );
}