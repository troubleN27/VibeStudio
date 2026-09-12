import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Middleware работает в Edge-runtime, поэтому не может использовать Prisma.
 * Здесь используется только проверка подписи JWT-cookie через withAuth
 * (без обращения к БД) — этого достаточно, чтобы закрыть /admin/* и /api/admin/*
 * от неавторизованного доступа.
 *
 * Дополнительно эндпоинты, требующие свежих данных пользователя,
 * проверяют сессию через getServerSession(authOptions) внутри route-хендлера.
 */
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;

    // Авторизованный пользователь на /admin/login → редирект в панель
    if (pathname === "/admin/login" && req.nextauth.token) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Публичный логин-эндпоинт
        if (pathname === "/admin/login") return true;

        // NextAuth-служебные роуты всегда пропускаем
        if (pathname.startsWith("/api/auth")) return true;

        // Telegram-webhook не требует сессии
        if (pathname === "/api/telegram/webhook") return true;

        // Публичное API каталога (залы/услуги/доступность/создание брони)
        if (
          pathname === "/api/halls" ||
          pathname.startsWith("/api/halls/") ||
          pathname === "/api/services" ||
          pathname.startsWith("/api/services/") ||
          pathname === "/api/availability" ||
          pathname === "/api/bookings"
        ) {
          // GET/POST на эти пути публичные; PATCH/DELETE — только админ.
          // Точную проверку метода делает route-хендлер через getServerSession.
          return true;
        }

        // Всё, что начинается с /admin или /api/admin — только с токеном
        return !!token;
      }
    },
    pages: {
      signIn: "/admin/login"
    }
  }
);

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};