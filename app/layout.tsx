import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { TelegramMiniAppInit } from "@/components/TelegramMiniAppInit";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "TIYIN Space — Прямой доступ к компаниям и сервисам",
  description:
    "Найдите нужную компанию в вашем городе, откройте каталог и общайтесь с ИИ-ассистентом. Бизнесам — личный кабинет, витрина по QR и база клиентов.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TIYIN Space",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <TelegramMiniAppInit />
        {children}
      </body>
    </html>
  );
}
