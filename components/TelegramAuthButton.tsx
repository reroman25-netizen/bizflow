"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

interface TelegramWebAppWindow {
  Telegram?: {
    WebApp?: {
      initData?: string;
      ready?: () => void;
    };
  };
  onTiyinTelegramAuth?: (user: Record<string, unknown>) => void;
}

export interface TelegramAuthResult {
  ok: boolean;
  token_hash?: string;
  role?: string;
  linked?: boolean;
  telegram_id?: string;
  telegram_username?: string;
}

interface TelegramAuthButtonProps {
  roleMode?: "business" | "client";
  action?: "login" | "link";
  accessToken?: string;
  label?: string;
  onSuccess: (result: TelegramAuthResult) => void | Promise<void>;
  onError?: (message: string) => void;
}

const DEFAULT_BOT_USERNAME = (
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "Tiyinapp"
)
  .replace(/^@/, "")
  .trim();

export function TelegramAuthButton({
  roleMode = "business",
  action = "login",
  accessToken,
  label,
  onSuccess,
  onError,
}: TelegramAuthButtonProps) {
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [miniAppInitData, setMiniAppInitData] = useState("");
  const [loading, setLoading] = useState(false);

  const roleModeRef = useRef(roleMode);
  const actionRef = useRef(action);
  const accessTokenRef = useRef(accessToken);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    roleModeRef.current = roleMode;
    actionRef.current = action;
    accessTokenRef.current = accessToken;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [roleMode, action, accessToken, onSuccess, onError]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as unknown as TelegramWebAppWindow;
    const initData = win.Telegram?.WebApp?.initData || "";
    if (initData) {
      win.Telegram?.WebApp?.ready?.();
      setIsMiniApp(true);
      setMiniAppInitData(initData);
      return;
    }

    setIsMiniApp(false);

    // Глобальный колбэк для официального Telegram Login Widget
    win.onTiyinTelegramAuth = async (user: Record<string, unknown>) => {
      setLoading(true);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (actionRef.current === "link" && accessTokenRef.current) {
          headers.Authorization = `Bearer ${accessTokenRef.current}`;
        }

        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers,
          body: JSON.stringify({
            mode: "widget",
            action: actionRef.current,
            roleMode: roleModeRef.current,
            widgetData: user,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          onErrorRef.current?.(json.error || "Не удалось войти через Telegram.");
          return;
        }
        await onSuccessRef.current(json);
      } catch {
        onErrorRef.current?.("Ошибка соединения при входе через Telegram.");
      } finally {
        setLoading(false);
      }
    };

    const container = widgetContainerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", DEFAULT_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-onauth", "onTiyinTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, []);

  const handleMiniAppAuth = async () => {
    if (!miniAppInitData) return;
    setLoading(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (action === "link" && accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode: "webapp",
          action,
          roleMode,
          initData: miniAppInitData,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        onError?.(json.error || "Не удалось войти через Telegram Mini App.");
        return;
      }
      await onSuccess(json);
    } catch {
      onError?.("Ошибка соединения с сервером.");
    } finally {
      setLoading(false);
    }
  };

  if (isMiniApp) {
    return (
      <button
        type="button"
        onClick={handleMiniAppAuth}
        disabled={loading}
        className="w-full py-3.5 px-4 rounded-xl bg-[#229ED9] hover:bg-[#1c8cc2] disabled:opacity-50 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition shadow-sm"
      >
        <Send className="w-4 h-4" />
        <span>
          {loading
            ? "Входим через Telegram..."
            : label ||
              (action === "link"
                ? "Привязать этот Telegram"
                : "Продолжить через Telegram")}
        </span>
      </button>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center gap-2">
      <div
        ref={widgetContainerRef}
        className="min-h-[42px] flex items-center justify-center"
      />
      {loading && (
        <div className="text-xs text-slate-500">Выполняем вход через Telegram...</div>
      )}
    </div>
  );
}