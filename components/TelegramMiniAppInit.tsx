"use client";

import { useEffect } from "react";

interface TelegramWebApp {
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  isExpanded?: boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

function initTelegramApp() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return false;

  try {
    tg.ready?.();
    tg.expand?.();
    tg.disableVerticalSwipes?.();
    tg.setHeaderColor?.("#ffffff");
    tg.setBackgroundColor?.("#F7F8FA");
  } catch {
    // ignore unsupported methods on older Telegram clients
  }
  return true;
}

export function TelegramMiniAppInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Блокируем случайный щипок (pinch-zoom) на iOS Safari / PWA / Telegram WebView
    const preventGesture = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });

    // 2. Инициализируем Telegram Mini App SDK (если скрипт ещё не подгружен — подгружаем)
    const initialized = initTelegramApp();
    if (!initialized) {
      const existingScript = document.querySelector(
        'script[src="https://telegram.org/js/telegram-web-app.js"]'
      );
      if (existingScript) {
        existingScript.addEventListener("load", () => initTelegramApp(), { once: true });
      } else {
        const script = document.createElement("script");
        script.src = "https://telegram.org/js/telegram-web-app.js";
        script.async = true;
        script.onload = () => initTelegramApp();
        document.head.appendChild(script);
      }
    }

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
    };
  }, []);

  return null;
}
