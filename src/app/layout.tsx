import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vibe Studio — бронирование фотостудии",
  description:
    "Онлайн-бронирование фотостудии: выберите зал, услугу и удобное время. Telegram-бот для быстрого бронирования.",
  keywords: ["фотостудия", "бронирование", "аренда зала", "Vibe Studio"]
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-ink-950 text-stone-200">
        {children}
      </body>
    </html>
  );
}