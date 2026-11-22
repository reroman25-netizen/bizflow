"use client";

import { useEffect } from "react";

interface TelegramWebApp {
  initData?: string;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

interface TelegramMiniAppInitProps {
  onInsideTelegram?: (isInside: boolean) => void;
}

export function TelegramMiniAppInit({ onInsideTelegram }: TelegramMiniAppInitProps) {
  useEffect(() => {
    const initWebApp = () => {
      const tg = window.Telegram?.WebApp;
      if (!tg) return;

      const inside = Boolean(tg.initData && tg.initData.length > 0);
      if (onInsideTelegram) {
        onInsideTelegram(inside);
      }

      if (inside) {
        tg.ready();
        tg.expand();
        try {
          tg.setHeaderColor?.("#ffffff");
          tg.setBackgroundColor?.("#F4F5F7");
          tg.disableVerticalSwipes?.();
        } catch {
          // Игнорируем неподдерживаемые методы на старых версиях Telegram
        }
      }
    };

    if (window.Telegram?.WebApp) {
      initWebApp();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://telegram.org/js/telegram-web-app.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", initWebApp);
      return () => existingScript.removeEventListener("load", initWebApp);
    }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = initWebApp;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [onInsideTelegram]);

  return null;
}
