import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "TIYIN Space — Прямой доступ к компаниям и сервисам",
  description:
    "Найдите нужную компанию в вашем городе, откройте каталог и общайтесь с ИИ-ассистентом. Бизнесам — личный кабинет, витрина по QR и база клиентов.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
