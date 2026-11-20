"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Building2, User, ArrowLeft, Mail, Lock } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { BrandLogo } from "@/components/BrandLogo";

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
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      const supabase = getSupabaseClient();

      if (authTab === "register") {
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
          <p className="text-sm text-slate-500 mb-6">
            {roleMode === "business"
              ? "После входа по почте откроется ваш личный кабинет и витрина."
              : "Регистрация для клиентов не обязательна — вы всегда можете заказывать без входа."}
          </p>

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
              disabled={loading}
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
