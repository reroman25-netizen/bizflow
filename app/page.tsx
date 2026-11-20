"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Store,
  Building2,
  User,
  LogOut,
  Shield,
  ArrowRight,
  MapPin,
  Bot,
  AlertTriangle,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Business, Profile } from "@/lib/types";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseClient();

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (user) {
        setUserEmail(user.email || null);
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (prof) {
          setProfile(prof as Profile);
          if (prof.role === "admin") setIsAdmin(true);
        }
        // Также проверяем админ-права через сервер (по ADMIN_EMAIL)
        if (data.session?.access_token) {
          const res = await fetch("/api/admin/check", {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          if (res.ok) {
            const json = await res.json();
            if (json.isAdmin) setIsAdmin(true);
          }
        }
      }
    };

    loadSession();
  }, []);

  // Живой поиск по мере ввода (с небольшой задержкой)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setBusinesses([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const supabase = getSupabaseClient();
      const safe = trimmed.replace(/[%_,]/g, "");
      const { data } = await supabase
        .from("businesses")
        .select("*")
        .eq("is_active", true)
        .or(
          `name.ilike.%${safe}%,slug.ilike.%${safe}%,tagline.ilike.%${safe}%,services_description.ilike.%${safe}%`
        )
        .limit(12);

      setBusinesses((data as Business[]) || []);
      setHasSearched(true);
      setSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    setUserEmail(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-lg text-slate-900"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              B
            </div>
            <span>BizFlow</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 text-white text-xs sm:text-sm font-medium hover:bg-purple-700 transition"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Админка</span>
              </Link>
            )}

            {userEmail ? (
              <>
                {(profile?.role === "business" || isAdmin) && (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-medium hover:bg-slate-800 transition"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Мой кабинет</span>
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs sm:text-sm hover:bg-slate-100 transition"
                  title={`Выйти (${userEmail})`}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Выйти</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth?mode=client"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs sm:text-sm font-medium transition"
                >
                  <User className="w-4 h-4" />
                  <span>Вход клиента</span>
                </Link>
                <Link
                  href="/auth?mode=business"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-medium hover:bg-slate-800 transition"
                >
                  <Building2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Для бизнеса</span>
                  <span className="sm:hidden">Бизнесу</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Config warning if env vars not set yet */}
      {!isSupabaseConfigured && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-2 text-xs sm:text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Остался один шаг: добавьте ключи <strong>NEXT_PUBLIC_SUPABASE_URL</strong> и{" "}
              <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> в настройках Vercel.
            </span>
          </div>
        </div>
      )}

      {/* Main Centered Search */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-5">
            <Bot className="w-4 h-4" />
            Прямая связь с компаниями и ИИ-помощниками
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Поиск нужной компании
          </h1>
          <p className="text-slate-600 text-sm sm:text-lg mb-8 max-w-xl mx-auto">
            Введите название сервиса, кафе, клиники или короткий код — и сразу
            переходите на их витрину, каталог и чат без регистрации.
          </p>

          {/* LARGE PROMINENT SEARCH BAR */}
          <div className="relative">
            <Search className="w-6 h-6 text-blue-600 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Например: Чебуречная у Айгерим, стоматология, автомойка..."
              className="w-full pl-14 pr-6 py-5 rounded-2xl border-2 border-slate-300 bg-white shadow-md text-base sm:text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
              autoFocus
            />
          </div>

          {/* Search Results */}
          <div className="mt-5 text-left">
            {searching && (
              <div className="text-center py-6 text-sm text-slate-500">
                Ищем компании...
              </div>
            )}

            {!searching && hasSearched && businesses.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
                По запросу «<strong>{query}</strong>» компаний пока не найдено.
              </div>
            )}

            {!searching && businesses.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
                  Найденные компании ({businesses.length})
                </div>
                {businesses.map((b) => (
                  <Link
                    key={b.id}
                    href={`/${b.slug}`}
                    className="group flex items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Store className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-base sm:text-lg text-slate-900 group-hover:text-blue-600 transition truncate">
                          {b.name}
                        </div>
                        {b.tagline && (
                          <p className="text-xs sm:text-sm text-slate-600 line-clamp-1 mt-0.5">
                            {b.tagline}
                          </p>
                        )}
                        {b.address && (
                          <div className="inline-flex items-center gap-1 text-xs text-slate-400 mt-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{b.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-blue-600">
                      Открыть
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Business CTA Section */}
      <section className="bg-white border-t border-slate-200 py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5 bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold mb-1">
              У вас свой бизнес или услуги?
            </h2>
            <p className="text-slate-300 text-sm">
              Создайте платформу своего бизнеса: онлайн-витрина по QR, каталог,
              база клиентов и ИИ-агент 24/7.
            </p>
          </div>
          <Link
            href={
              userEmail && (profile?.role === "business" || isAdmin)
                ? "/dashboard"
                : "/auth?mode=business&tab=register"
            }
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm sm:text-base transition"
          >
            <Building2 className="w-5 h-5" />
            <span>Создать платформу своего бизнеса</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
