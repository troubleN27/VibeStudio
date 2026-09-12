"use client";

import { useEffect, useState } from "react";
import { IconCamera, IconCheck, IconGrid, IconSave } from "@/components/ui/icons";

export type HallFormValues = {
  id?: string;
  name: string;
  description: string;
  photoUrl: string;
  isActive: boolean;
};

type HallFormProps = {
  initial?: HallFormValues | null;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (values: HallFormValues) => void;
  onCancel: () => void;
};

const EMPTY: HallFormValues = {
  name: "",
  description: "",
  photoUrl: "",
  isActive: true
};

export default function HallForm({
  initial,
  submitting = false,
  error = null,
  onSubmit,
  onCancel
}: HallFormProps) {
  const [values, setValues] = useState<HallFormValues>(initial ?? EMPTY);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setValues(initial ?? EMPTY);
    setTouched(false);
  }, [initial]);

  const nameError =
    touched && values.name.trim().length < 2
      ? "Название минимум 2 символа"
      : null;

  const urlError =
    touched && values.photoUrl.length > 0 && !isValidUrl(values.photoUrl)
      ? "Некорректный URL"
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (values.name.trim().length < 2) return;
    if (values.photoUrl.length > 0 && !isValidUrl(values.photoUrl)) return;

    onSubmit({
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
      photoUrl: values.photoUrl.trim()
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card mx-auto max-w-2xl overflow-hidden !shadow-lift"
    >
      {/* Шапка */}
      <div className="border-b border-ink-800 bg-ink-800/50 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-glow">
            <IconGrid width={19} height={19} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-white">
              {initial?.id ? "Редактировать зал" : "Новый зал"}
            </h2>
            <p className="text-xs text-stone-500">
              Пространство, которое увидят клиенты при бронировании
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div>
          <label htmlFor="hall-name" className="label">
            Название <span className="text-brand-600">*</span>
          </label>
          <input
            id="hall-name"
            type="text"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            className="input"
            placeholder="Например, «Лофт»"
            disabled={submitting}
          />
          {nameError && <p className="mt-1.5 text-xs text-rose-400">{nameError}</p>}
        </div>

        <div>
          <label htmlFor="hall-description" className="label">
            Описание
          </label>
          <textarea
            id="hall-description"
            value={values.description}
            onChange={(e) =>
              setValues({ ...values, description: e.target.value })
            }
            className="input min-h-[96px]"
            placeholder="Просторный лофт с панорамными окнами, циклорамой и готовым декором..."
            disabled={submitting}
          />
        </div>

        <div>
          <label htmlFor="hall-photo" className="label">
            URL фото
          </label>
          <input
            id="hall-photo"
            type="url"
            value={values.photoUrl}
            onChange={(e) => setValues({ ...values, photoUrl: e.target.value })}
            className="input"
            placeholder="https://example.com/hall.jpg"
            disabled={submitting}
          />
          {urlError && <p className="mt-1.5 text-xs text-rose-400">{urlError}</p>}
          {values.photoUrl && !urlError && (
            <div className="mt-3 flex items-center gap-3">
              <div className="h-20 w-28 overflow-hidden rounded-lg bg-ink-800 shadow-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={values.photoUrl}
                  alt="Предпросмотр зала"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-xs text-stone-400">
                Предпросмотр обложки
              </span>
            </div>
          )}
        </div>

        {/* Переключатель активности */}
        <div className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-800/50 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-700 bg-ink-900 text-stone-400 shadow-soft">
              <IconCamera width={17} height={17} />
            </span>
            <div>
              <div className="text-sm font-medium text-white">
                Активен на сайте
              </div>
              <div className="text-xs text-stone-500">
                Видим клиентам при бронировании
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={values.isActive}
            disabled={submitting}
            onClick={() => setValues({ ...values, isActive: !values.isActive })}
            className={`relative h-7 w-12 rounded-full transition-colors duration-200 focus:outline-none ${
              values.isActive ? "bg-brand-600" : "bg-ink-600"
            }`}
          >
            <span
              className={`absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-all duration-200 ${
                values.isActive ? "left-6" : "left-1"
              }`}
            >
              {values.isActive && (
                <IconCheck width={12} height={12} strokeWidth={3} className="text-brand-600" />
              )}
            </span>
          </button>
        </div>

        {error && <div className="alert-error">{error}</div>}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-ink-800 bg-ink-800/40 px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost"
          disabled={submitting}
        >
          Отмена
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          <IconSave width={16} height={16} />
          {submitting ? "Сохраняем..." : "Сохранить зал"}
        </button>
      </div>
    </form>
  );
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}