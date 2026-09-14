"use client";

import { useEffect, useState } from "react";

/**
 * Клиентская интеграция Telegram Mini App на странице /booking.
 *
 * - подключает официальный скрипт telegram-web-app.js;
 * - вызывает ready()/expand() и подстраивает цвета под тёмную тему;
 * - отдаёт initData и данные пользователя для подстановки имени
 *   и серверной валидации (см. src/lib/telegram-webapp.ts).
 */

export type TelegramUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
};

export type TelegramMiniAppState = {
  ready: boolean;
  isTelegram: boolean;
  initData: string | null;
  user: TelegramUser | null;
};

const SCRIPT_URL = "https://telegram.org/js/telegram-web-app.js";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        disableVerticalSwipes?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
      };
    };
  }
}

export function useTelegramMiniApp(): TelegramMiniAppState {
  const [state, setState] = useState<TelegramMiniAppState>({
    ready: false,
    isTelegram: false,
    initData: null,
    user: null
  });

  useEffect(() => {
    let disposed = false;

    const init = () => {
      if (disposed) return;
      const webApp = window.Telegram?.WebApp;
      const user = webApp?.initDataUnsafe?.user;

      // В обычном браузере (или в Telegram без user) работаем как на сайте.
      if (!webApp || !user) {
        setState({ ready: true, isTelegram: false, initData: null, user: null });
        return;
      }

      webApp.ready();
      webApp.expand();
      webApp.disableVerticalSwipes?.();
      webApp.setHeaderColor?.("#0b0b12");
      webApp.setBackgroundColor?.("#0b0b12");

      setState({
        ready: true,
        isTelegram: true,
        initData: webApp.initData,
        user: {
          id: String(user.id),
          firstName: user.first_name ?? null,
          lastName: user.last_name ?? null,
          username: user.username ?? null
        }
      });
    };

    if (window.Telegram?.WebApp) {
      init();
      return;
    }

    const el = document.createElement("script");
    el.src = SCRIPT_URL;
    el.async = true;
    el.onload = () => init();
    document.head.appendChild(el);

    return () => {
      disposed = true;
      el.remove();
    };
  }, []);

  return state;
}