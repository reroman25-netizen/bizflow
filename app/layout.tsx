import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "BizFlow KZ — Кабинет бизнеса и клиентские витрины",
  description:
    "Единая платформа для малого и среднего бизнеса: ИИ-агент, онлайн-витрина по QR и база клиентов.",
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
