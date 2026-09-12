"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Logo from "@/components/ui/Logo";
import {
  IconCalendar,
  IconCalendarCheck,
  IconChart,
  IconGrid,
  IconGlobe,
  IconLogout,
  IconMenu,
  IconSparkle,
  IconUsers,
  IconX
} from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/admin/bookings", label: "Бронирования", icon: IconCalendarCheck },
  { href: "/admin/halls", label: "Залы", icon: IconGrid },
  { href: "/admin/services", label: "Услуги", icon: IconSparkle },
  { href: "/admin/schedule", label: "Расписание", icon: IconCalendar },
  { href: "/admin/clients", label: "Клиенты", icon: IconUsers },
  { href: "/admin/analytics", label: "Аналитика", icon: IconChart }
];

type SessionUser = {
  name?: string | null;
  login?: string | null;
};

type SessionState =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: SessionUser }
  | { status: "unauthenticated"; user: null };

function userInitials(user: SessionUser): string {
  const raw = user.login ?? user.name ?? "A";
  return raw.trim().slice(0, 2).toUpperCase();
}

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [session, setSession] = useState<SessionState>({
    status: "loading",
    user: null
  });

  useEffect(() => {
    if (isLoginPage) return;
    let cancelled = false;

    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && data.user) {
          setSession({ status: "authenticated", user: data.user });
        } else {
          setSession({ status: "unauthenticated", user: null });
          router.replace("/admin/login");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSession({ status: "unauthenticated", user: null });
        router.replace("/admin/login");
      });

    return () => {
      cancelled = true;
    };
  }, [isLoginPage, pathname, router]);

  // Закрываем мобильное меню при смене страницы
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (session.status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950">
        <div className="flex items-center gap-2.5 text-sm text-stone-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-600 border-t-brand-500" />
          Загрузка панели управления...
        </div>
      </div>
    );
  }

  if (session.status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="text-sm text-stone-500">
          Перенаправление на страницу входа...
        </div>
      </div>
    );
  }

  async function handleLogout() {
    try {
      await signOut({ callbackUrl: "/admin/login", redirect: true });
    } catch {
      router.replace("/admin/login");
    }
  }

  const activeItem =
    NAV_ITEMS.find((i) => pathname.startsWith(i.href)) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-ink-950">
      {/* ===== Desktop sidebar ===== */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-800 bg-ink-900 lg:flex">
        <div className="flex h-16 items-center border-b border-ink-800 px-5">
          <Link href="/admin/bookings">
            <Logo light />
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-5">
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-stone-500">
            Управление
          </div>
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-brand-600 text-white shadow-soft"
                    : "text-stone-300 hover:bg-ink-800 hover:text-white"
                ].join(" ")}
              >
                <Icon
                  width={18}
                  height={18}
                  className={active ? "text-white" : "text-stone-500 group-hover:text-brand-300"}
                />
                {item.label}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink-800 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2.5 py-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white">
              {userInitials(session.user)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">
                {session.user.login ?? session.user.name ?? "Администратор"}
              </div>
              <div className="text-xs text-stone-500">Администратор</div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Link
              href="/"
              target="_blank"
              className="btn-ghost btn-sm w-full"
            >
              <IconGlobe width={15} height={15} />
              Сайт
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-ghost-danger btn-sm w-full"
            >
              <IconLogout width={15} height={15} />
              Выйти
            </button>
          </div>
        </div>
      </aside>

      {/* ===== Mobile drawer ===== */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink-900 shadow-lift animate-fade-in-up">
            <div className="flex h-16 items-center justify-between border-b border-ink-800 px-5">
              <Logo light />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-ink-800"
                aria-label="Закрыть меню"
              >
                <IconX width={18} height={18} />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 px-3 py-5">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand-600 text-white"
                        : "text-stone-300 hover:bg-ink-800"
                    ].join(" ")}
                  >
                    <Icon width={18} height={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-ink-800 p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="btn-ghost-danger w-full"
              >
                <IconLogout width={16} height={16} />
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Content column ===== */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-800 bg-ink-950/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-ink-800 lg:hidden"
            aria-label="Открыть меню"
          >
            <IconMenu width={19} height={19} />
          </button>

          <div className="min-w-0">
            <div className="hidden text-[11px] font-medium uppercase tracking-widest text-stone-500 sm:block">
              Vibe Studio
            </div>
            <div className="truncate text-[15px] font-semibold tracking-tight text-white">
              {activeItem.label}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="btn-secondary btn-sm hidden sm:inline-flex"
            >
              <IconGlobe width={15} height={15} />
              Открыть сайт
            </Link>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white">
              {userInitials(session.user)}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}