import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7 // 7 дней
  },

  pages: {
    signIn: "/admin/login"
  },

  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        login: { label: "Логин", type: "text" },
        password: { label: "Пароль", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) {
          return null;
        }

        const login = credentials.login.trim();
        const user = await prisma.adminUser.findUnique({
          where: { login }
        });

        if (!user) {
          // Не раскрываем, существует ли пользователь
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          name: user.login,
          login: user.login
        };
      }
    })
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.login = (user as { login?: string }).login ?? user.name ?? "";
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { login?: string }).login =
          (token.login as string) ?? "";
      }
      return session;
    }
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === "development"
};

/**
 * Расширение типов NextAuth (id/login в session.user).
 * Объявлено через module augmentation, чтобы TypeScript знал о полях.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      login?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    login?: string;
    name?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    login?: string;
  }
}