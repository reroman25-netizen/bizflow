"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  User,
  ArrowLeft,
  Mail,
  Lock,
  CheckCircle2,
  KeyRound,
  UserPlus,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { BrandLogo } from "@/components/BrandLogo";
import {
  TelegramAuthButton,
  TelegramAuthResult,
  TelegramRawAuth,
} from "@/components/TelegramAuthButton";
import { TelegramMiniAppInit } from "@/components/TelegramMiniAppInit";
import { LegalConsentCheckbox } from "@/components/LegalConsentCheckbox";

interface TelegramWebAppExtended {
  Telegram?: {
    WebApp?: {
      initData?: string;
      initDataUnsafe?: {
        start_param?: string;
      };
    };
  };
}

async function tryAutoLinkTelegramWebApp(accessToken: string) {
  try {
    if (typeof window === "undefined") return;
    const tg = (window as unknown as TelegramWebAppExtended).Telegram;
    const initData = tg?.WebApp?.initData || "";
    if (!initData) return;
    await fetch("/api/auth/telegram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        mode: "webapp",
        action: "link",
        initData,
      }),
    });
  } catch {
    // ignore background link errors
  }
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.29v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1c.95-2.84 3.6-4.95 6.72-4.95z"
      />
    </svg>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "client" ? "client" : "business";
  const initialTab = searchParams.get("tab") === "login" ? "login" : "register";

  const [roleMode, setRoleMode] = useState<"business" | "client">(initialMode);
  const [authTab, setAuthTab] = useState<"register" | "login">(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);

  // Экран выбора для нового Telegram (чтобы не создавать случайных дублей)
  const [pendingTgChoice, setPendingTgChoice] = useState<{
    rawAuth: TelegramRawAuth;
    username: string;
    fullName: string;
  } | null>(null);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [linkCode, setLinkCode] = useState("");

  const completeSessionFromTokenHash = async (tokenHash: string, role?: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });

    if (error || !data.session) {
      setErrorMsg(error?.message || "Не удалось создать сессию входа.");
      return;
    }

    const checkRes = await fetch("/api/admin/check", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (checkRes.ok) {
      const checkJson = await checkRes.json();
      if (checkJson.isAdmin) {
        router.push("/admin");
        return;
      }
    }

    if (role === "client") {
      router.push("/");
    } else {
      router.push("/dashboard");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as unknown as TelegramWebAppExtended;
    const initData = win.Telegram?.WebApp?.initData || "";
    if (!initData) return;

    setIsMiniApp(true);

    // Если Mini App открыто по умной ссылке привязки (?startapp=L_...)
    const startParam =
      win.Telegram?.WebApp?.initDataUnsafe?.start_param ||
      new URLSearchParams(window.location.search).get("tgWebAppStartParam") ||
      "";

    if (startParam && startParam.startsWith("L_")) {
      const autoLink = async () => {
        setLoading(true);
        setErrorMsg("");
        setInfoMsg("Привязываем Telegram к вашему кабинету...");
        try {
          const res = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "webapp",
              action: "link_by_code",
              initData,
              startParam,
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.ok || !json.token_hash) {
            setInfoMsg("");
            setErrorMsg(json.error || "Ссылка привязки устарела. Получите новую в Настройках.");
            return;
          }
          await completeSessionFromTokenHash(json.token_hash, json.role);
        } catch {
          setInfoMsg("");
          setErrorMsg("Ошибка соединения при привязке Telegram.");
        } finally {
          setLoading(false);
        }
      };
      autoLink();
    }
  }, []);

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setInfoMsg("");
    setGoogleLoading(true);
    try {
      const supabase = getSupabaseClient();
      const redirectTo = `${window.location.origin}/auth/callback?role=${roleMode}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) {
        setErrorMsg(error.message || "Не удалось запустить вход через Google.");
        setGoogleLoading(false);
      }
    } catch {
      setErrorMsg("Ошибка соединения при входе через Google.");
      setGoogleLoading(false);
    }
  };

  const handleTelegramSuccess = async (result: TelegramAuthResult) => {
    setErrorMsg("");
    setInfoMsg("");

    // Новый Telegram — спрашиваем пользователя, создать новый кабинет или привязать к существующему
    if (result.needs_choice && result.rawAuth) {
      setPendingTgChoice({
        rawAuth: result.rawAuth,
        username: result.telegram_username || "",
        fullName: result.full_name || "Пользователь",
      });
      setShowCodeInput(false);
      setLinkCode("");
      return;
    }

    if (!result.token_hash) {
      setErrorMsg("Не удалось завершить вход через Telegram.");
      return;
    }

    setLoading(true);
    try {
      await completeSessionFromTokenHash(result.token_hash, result.role);
    } catch {
      setErrorMsg("Ошибка соединения при входе через Telegram.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCreateTelegramAccount = async () => {
    if (!pendingTgChoice) return;
    setErrorMsg("");
    setLoading(true);
    try {
      const { rawAuth } = pendingTgChoice;
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: rawAuth.mode,
          action: "login",
          allowCreate: true,
          roleMode,
          initData: rawAuth.initData,
          widgetData: rawAuth.widgetData,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.token_hash) {
        setErrorMsg(json.error || "Не удалось создать аккаунт через Telegram.");
        return;
      }
      await completeSessionFromTokenHash(json.token_hash, json.role);
    } catch {
      setErrorMsg("Ошибка соединения с сервером.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLinkCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTgChoice) return;
    const cleanCode = linkCode.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setErrorMsg("Введите 6-значный код из Настроек на сайте.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const { rawAuth } = pendingTgChoice;
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: rawAuth.mode,
          action: "link_by_code",
          code: cleanCode,
          initData: rawAuth.initData,
          widgetData: rawAuth.widgetData,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.token_hash) {
        setErrorMsg(json.error || "Неверный или устаревший код.");
        return;
      }
      await completeSessionFromTokenHash(json.token_hash, json.role);
    } catch {
      setErrorMsg("Ошибка соединения с сервером.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      const supabase = getSupabaseClient();

      if (authTab === "register") {
        if (!legalAccepted) {
          setErrorMsg(
            "Подтвердите согласие с условиями, Политикой конфиденциальности и обработкой персональных данных."
          );
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName.trim(),
            role: roleMode,
          });
        }

        if (!data.session) {
          setInfoMsg(
            "Аккаунт создан! Подтвердите почту по ссылке в письме, затем войдите."
          );
          setLoading(false);
          return;
        }

        await tryAutoLinkTelegramWebApp(data.session.access_token);
        router.push(roleMode === "business" ? "/dashboard" : "/");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg("Неверная почта или пароль.");
        setLoading(false);
        return;
      }

      const user = data.user;
      if (user) {
        if (data.session?.access_token) {
          await tryAutoLinkTelegramWebApp(data.session.access_token);
        }
        const checkRes = await fetch("/api/admin/check", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        if (checkRes.ok) {
          const checkJson = await checkRes.json();
          if (checkJson.isAdmin) {
            router.push("/admin");
            return;
          }
        }

        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!prof) {
          await supabase.from("profiles").upsert({
            id: user.id,
            email: user.email,
            role: roleMode,
          });
          router.push(roleMode === "business" ? "/dashboard" : "/");
          return;
        }

        if (prof.role === "business" || prof.role === "admin") {
          router.push("/dashboard");
        } else {
          router.push("/");
        }
      }
    } catch {
      setErrorMsg("Ошибка соединения с сервером.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] flex flex-col justify-center items-center px-4 py-10">
      <TelegramMiniAppInit />
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <BrandLogo size="sm" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 hover:text-neutral-900"
          >
            <ArrowLeft className="w-4 h-4" />
            К поиску
          </Link>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {pendingTgChoice ? (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-neutral-950">
                  Добро пожаловать, {pendingTgChoice.fullName}!
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Этот Telegram{" "}
                  {pendingTgChoice.username ? `(@${pendingTgChoice.username}) ` : ""}
                  ещё не привязан к кабинету TIYIN Space. Выберите, как продолжить:
                </p>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmCreateTelegramAccount}
                className="w-full py-3.5 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {loading ? "Создаём кабинет..." : "Создать новый кабинет"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCodeInput((prev) => !prev);
                  setErrorMsg("");
                }}
                className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-neutral-900 font-semibold text-sm inline-flex items-center justify-center gap-2 transition"
              >
                <KeyRound className="w-4 h-4" />
                <span>У меня уже есть аккаунт на сайте</span>
              </button>

              {showCodeInput && (
                <form
                  onSubmit={handleSubmitLinkCode}
                  className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3"
                >
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Откройте <strong>tiyin.kz → Настройки → Способы входа</strong>, нажмите{" "}
                    <strong>«Код для Telegram»</strong> и введите 6 цифр ниже — ваш кабинет
                    сразу откроется здесь:
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={linkCode}
                    onChange={(e) =>
                      setLinkCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-center text-lg font-mono tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading || linkCode.length !== 6}
                    className="w-full py-3 rounded-xl bg-[#229ED9] hover:bg-[#1c8cc2] disabled:opacity-50 text-white font-semibold text-sm transition"
                  >
                    {loading ? "Привязываем..." : "Привязать и войти"}
                  </button>
                </form>
              )}

              {errorMsg && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setPendingTgChoice(null);
                  setShowCodeInput(false);
                  setErrorMsg("");
                }}
                className="w-full text-center text-xs font-medium text-slate-500 hover:text-neutral-900 pt-1"
              >
                ← Вернуться к выбору способа входа
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => setRoleMode("business")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition ${
                    roleMode === "business"
                      ? "bg-white text-neutral-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Я бизнес
                </button>
                <button
                  type="button"
                  onClick={() => setRoleMode("client")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition ${
                    roleMode === "client"
                      ? "bg-white text-neutral-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Я клиент
                </button>
              </div>

              <h1 className="text-2xl font-bold text-neutral-950 mb-1">
                {authTab === "register"
                  ? roleMode === "business"
                    ? "Создать платформу бизнеса"
                    : "Регистрация клиента"
                  : "Вход в TIYIN Space"}
              </h1>
              <p className="text-sm text-slate-500 mb-5">
                {roleMode === "business"
                  ? "Войдите за 1 клик через Google или Telegram — без лишних паролей."
                  : "Регистрация для клиентов не обязательна — вы всегда можете заказывать без входа."}
              </p>

              {roleMode === "business" && authTab === "register" && (
                <div className="mb-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3.5 text-xs text-emerald-950 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>3 месяца бесплатно · далее 990 ₸/мес (PRO 4 990 ₸ — 1 мес. бесплатно)</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    <strong>0% комиссии с ваших продаж</strong> — мы не берем процент с заказов.
                    Витрина, база клиентов и брендированное приложение на экран телефона с вашим
                    логотипом доступны сразу после регистрации.
                  </p>
                </div>
              )}

              <div className="mb-5 space-y-3">
                {!isMiniApp && (
                  <button
                    type="button"
                    disabled={googleLoading || loading}
                    onClick={handleGoogleLogin}
                    className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-300 text-neutral-900 font-semibold text-sm inline-flex items-center justify-center gap-2.5 transition shadow-sm"
                  >
                    <GoogleIcon />
                    <span>
                      {googleLoading
                        ? "Переход в Google..."
                        : "Продолжить через Google"}
                    </span>
                  </button>
                )}

                <TelegramAuthButton
                  roleMode={roleMode}
                  action="login"
                  allowCreate={false}
                  onSuccess={handleTelegramSuccess}
                  onError={(msg) => setErrorMsg(msg)}
                />

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="mx-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    или по почте и паролю
                  </span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {authTab === "register" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Ваше имя
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Например: Айгерим"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Электронная почта (Email)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Пароль (минимум 6 символов)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      minLength={6}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      required
                    />
                  </div>
                </div>

                {authTab === "register" && (
                  <div className="pt-1">
                    <LegalConsentCheckbox
                      checked={legalAccepted}
                      onChange={setLegalAccepted}
                      mode={roleMode}
                    />
                  </div>
                )}

                {errorMsg && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                    {errorMsg}
                  </div>
                )}

                {infoMsg && (
                  <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                    {infoMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (authTab === "register" && !legalAccepted)}
                  className="w-full py-3.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white font-semibold text-sm transition"
                >
                  {loading
                    ? "Подождите..."
                    : authTab === "register"
                    ? "Зарегистрироваться"
                    : "Войти"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-500">
                {authTab === "register" ? (
                  <>
                    Уже есть аккаунт?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab("login");
                        setErrorMsg("");
                      }}
                      className="text-neutral-950 font-semibold hover:underline"
                    >
                      Войти
                    </button>
                  </>
                ) : (
                  <>
                    Еще нет аккаунта?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab("register");
                        setErrorMsg("");
                      }}
                      className="text-neutral-950 font-semibold hover:underline"
                    >
                      Создать
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
          <Link href="/offer" target="_blank" className="hover:text-neutral-700 underline">
            Оферта (Бизнесу)
          </Link>
          <Link href="/terms" target="_blank" className="hover:text-neutral-700 underline">
            Соглашение (Клиентам)
          </Link>
          <Link href="/privacy" target="_blank" className="hover:text-neutral-700 underline">
            Конфиденциальность
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          Загрузка...
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
