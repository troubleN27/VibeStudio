import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Универсальный обработчик NextAuth для всех /api/auth/* путей:
 *   - GET  /api/auth/session
 *   - GET  /api/auth/csrf
 *   - POST /api/auth/callback/credentials
 *   - POST /api/auth/signout
 *   - GET  /api/auth/providers
 *   - и т.д.
 *
 * Вся логика (провайдеры, колбэки, страницы) описана в src/lib/auth.ts.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };