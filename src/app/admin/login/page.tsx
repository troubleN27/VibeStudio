"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import {
  IconArrowLeft,
  IconCalendarCheck,
  IconBot,
  IconChart,
  IconCheck
} from "@/components/ui/icons";

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // NextAuth Credentials Provider: csrf + callback
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();

      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          csrfToken,
          login,
          password,
          json: "true"
        }).toString(),
        redirect: "manual"
      });

      if (res.status === 200 || res.status === 302) {
        // Проверим, что сессия действительно установлена
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();
        if (session && session.user) {
          router.replace("/admin/bookings");
          return;
        }
      }

      setError("Неверный логин или пароль");
    } catch {
      setError("Ошибка соединения. Попробуйте снова.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4 py-12">
      {/* Фон */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-hero-grid" />
        <div
          className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(105,65,232,0.28), transparent 70%)"
          }}
        />
      </div>

      <div className="relative grid w-full max-w-4xl gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
        {/* Левая панель */}
        <div className="hidden lg:block">
          <Logo light />
          <h1 className="mt-8 text-3xl font-semibold leading-tight tracking-tight text-white">
            Панель управления
            <br />
            студией
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/55">
            Управляйте бронированиями, залами, услугами и аналитикой из одного
            места. Всё, что нужно для работы студии.
          </p>

          <ul className="mt-8 space-y-3.5 text-sm text-white/75">
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/20 text-brand-200">
                <IconCalendarCheck width={15} height={15} />
              </span>
              Брони с сайта и Telegram в одной таблице
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/20 text-brand-200">
                <IconBot width={15} height={15} />
              </span>
              Отслеживайте клиентов по источникам
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/20 text-brand-200">
                <IconChart width={15} height={15} />
              </span>
              Загруженность залов и выручка
            </li>
          </ul>
        </div>

        {/* Форма */}
        <div className="w-full max-w-md lg:justify-self-end">
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-8 shadow-lift">
            <div className="lg:hidden">
              <Logo light />
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-300">
                <span className="h-1 w-1 rounded-full bg-brand-500" />
                Вход для администратора
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                Войдите в панель
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="login" className="label">
                  Логин
                </label>
                <input
                  id="login"
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="input"
                  placeholder="Ваш логин"
                  autoComplete="username"
                  autoFocus
                  disabled={submitting}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Пароль
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={submitting}
                  required
                />
              </div>

              {error && <div className="alert-error">{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3 text-base"
              >
                {submitting ? "Выполняем вход..." : "Войти в панель"}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-stone-400">
                <IconCheck width={13} height={13} className="text-emerald-500" />
                Защищённый вход, данные шифруются
              </div>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-white/40">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white/80"
            >
              <IconArrowLeft width={14} height={14} />
              Вернуться на сайт
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}