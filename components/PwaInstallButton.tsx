"use client";

import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, ExternalLink, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaInstallButtonProps {
  businessName: string;
  logoUrl?: string | null;
  pwaEnabled?: boolean;
  className?: string;
}

type PlatformMode = "android_prompt" | "ios_safari" | "in_app" | "fallback";

export function PwaInstallButton({
  businessName,
  logoUrl,
  pwaEnabled = true,
  className = "",
}: PwaInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [mode, setMode] = useState<PlatformMode>("fallback");
  const [isIos, setIsIos] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!pwaEnabled || typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(standalone);
    if (standalone) return;

    const ua = navigator.userAgent || "";
    const iosDevice = /iPhone|iPad|iPod/i.test(ua);
    const inAppBrowser =
      /Instagram|FBAN|FBAV|Telegram|WhatsApp|BytedanceWebview|Musical_ly|TikTok|Line\//i.test(ua) ||
      (iosDevice && !/Safari/i.test(ua));

    setIsIos(iosDevice);

    if (inAppBrowser) {
      setMode("in_app");
    } else if (iosDevice) {
      setMode("ios_safari");
    } else {
      setMode("fallback");
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode("android_prompt");
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setModalOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [pwaEnabled]);

  if (!pwaEnabled || isStandalone) return null;

  const handleClick = async () => {
    if (mode === "android_prompt" && deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } finally {
        setInstalling(false);
      }
      return;
    }

    setModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={installing}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm active:scale-[0.98] transition ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>{installing ? "Установка..." : "Установить приложение"}</span>
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 flex items-center justify-center">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={businessName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Smartphone className="h-6 w-6 text-slate-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-neutral-950 leading-tight truncate">
                    Установить «{businessName}»
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Быстрый доступ с экрана телефона
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-700">
              {mode === "in_app" && (
                <>
                  <p className="text-xs text-slate-500">
                    Вы открыли витрину внутри Instagram или Telegram — встроенный браузер
                    не позволяет устанавливать приложения напрямую.
                  </p>
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
                      1
                    </div>
                    <p>
                      Нажмите <b>•••</b> (или иконку браузера) в углу экрана и выберите{" "}
                      <b>«Открыть в {isIos ? "Safari" : "Chrome"}»</b>{" "}
                      <ExternalLink className="inline h-3.5 w-3.5 text-slate-500" />.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
                      2
                    </div>
                    <p>
                      После открытия снова нажмите кнопку{" "}
                      <b>«Установить приложение»</b> на этой странице.
                    </p>
                  </div>
                </>
              )}

              {mode === "ios_safari" && (
                <>
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
                      1
                    </div>
                    <p>
                      Нажмите кнопку <b>«Поделиться»</b>{" "}
                      <Share className="inline h-4 w-4 text-blue-600 -mt-0.5" /> на нижней
                      панели Safari.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
                      2
                    </div>
                    <p>
                      Прокрутите вниз, выберите <b>«На экран „Домой“»</b>{" "}
                      <PlusSquare className="inline h-4 w-4 text-slate-700 -mt-0.5" /> и
                      нажмите <b>«Добавить»</b>.
                    </p>
                  </div>
                </>
              )}

              {mode === "fallback" && (
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
                    1
                  </div>
                  <p>
                    Откройте меню браузера (<b>⋮</b> в правом верхнем углу) и выберите{" "}
                    <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="mt-5 w-full rounded-xl bg-neutral-950 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 transition"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default PwaInstallButton;
