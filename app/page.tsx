"use client";

import { useState, useEffect, useRef } from "react";
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
  ChevronDown,
  Check,
  AlertTriangle,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Business, Profile } from "@/lib/types";
import { KZ_CITIES, ALL_CITIES_LABEL } from "@/lib/cities";
import { BrandLogo } from "@/components/BrandLogo";
import { PhoneDemo } from "@/components/PhoneDemo";
import { SiteFooter } from "@/components/SiteFooter";

const CITY_STORAGE_KEY = "tiyin_space_city";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>(ALL_CITIES_LABEL);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(CITY_STORAGE_KEY);
    if (saved) setSelectedCity(saved);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        cityDropdownRef.current &&
        !cityDropdownRef.current.contains(e.target as Node)
      ) {
        setCityMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleSelectCity = (city: string) => {
    setSelectedCity(city);
    setCityMenuOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CITY_STORAGE_KEY, city);
    }
  };

  // Живой поиск по названию, категории, слогану и описанию с учетом города
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

      let req = supabase
        .from("businesses")
        .select("*")
        .eq("is_active", true)
        .or(
          `name.ilike.%${safe}%,slug.ilike.%${safe}%,category.ilike.%${safe}%,tagline.ilike.%${safe}%,services_description.ilike.%${safe}%`
        )
        .limit(12);

      if (selectedCity !== ALL_CITIES_LABEL) {
        req = req.eq("city", selectedCity);
      }

      const { data } = await req;
      setBusinesses((data as Business[]) || []);
      setHasSearched(true);
      setSearching(false);
    }, 220);

    return () => clearTimeout(timer);
  }, [query, selectedCity]);

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    setUserEmail(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const cityOptions = [ALL_CITIES_LABEL, ...KZ_CITIES];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFB]">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <Link href="/" className="shrink-0">
            <BrandLogo />
          </Link>

          <div className="flex items-center gap-2">
            <a
              href="#pricing"
              className="hidden md:inline-flex items-center px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition"
            >
              Тарифы
            </a>
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-950 text-white text-xs sm:text-sm font-medium hover:bg-neutral-800 transition"
                  >
                    <Building2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Мой кабинет</span>
                    <span className="sm:hidden">Кабинет</span>
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs sm:text-sm hover:bg-slate-100 transition"
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
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs sm:text-sm font-medium transition"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Вход клиента</span>
                  <span className="sm:hidden">Вход</span>
                </Link>
                <Link
                  href="/auth?mode=business"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-950 text-white text-xs sm:text-sm font-medium hover:bg-neutral-800 transition"
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

      {!isSupabaseConfigured && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-xs sm:text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Добавьте ключи Supabase в настройках Vercel для работы поиска и кабинетов.
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-14 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-7 lg:pt-6">
            <h1 className="text-[28px] sm:text-4xl lg:text-[46px] font-semibold text-neutral-950 tracking-[-0.025em] leading-[1.15]">
              Прямой доступ к компаниям и сервисам
            </h1>

            <p className="mt-4 text-sm sm:text-base text-neutral-500 leading-relaxed max-w-xl font-normal">
              Введите название сервиса, кафе, клиники или короткий код — и сразу
              переходите на их витрину, каталог и чат без регистрации.
            </p>

            {/* Unified City + Search Control */}
            <div className="mt-7 relative" ref={cityDropdownRef}>
              <div className="flex flex-col sm:flex-row bg-white rounded-2xl border border-slate-300/90 shadow-[0_8px_30px_rgb(0,0,0,0.05)] focus-within:border-neutral-900 focus-within:ring-4 focus-within:ring-neutral-900/5 transition">
                <button
                  type="button"
                  onClick={() => setCityMenuOpen((prev) => !prev)}
                  className="flex items-center justify-between sm:justify-start gap-2 px-4 py-3.5 sm:py-4 border-b sm:border-b-0 sm:border-r border-slate-200 text-sm font-medium text-neutral-800 hover:bg-slate-50 rounded-t-2xl sm:rounded-tr-none sm:rounded-l-2xl transition shrink-0 sm:min-w-[168px]"
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <MapPin className="w-4 h-4 text-neutral-500 shrink-0" />
                    <span className="truncate">{selectedCity}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${
                      cityMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div className="relative flex-1 flex items-center">
                  <Search className="w-5 h-5 text-neutral-400 absolute left-4 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Например: Ameli Shop"
                    className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-transparent text-base text-neutral-950 placeholder:text-neutral-400 focus:outline-none rounded-b-2xl sm:rounded-bl-none sm:rounded-r-2xl"
                  />
                </div>
              </div>

              {cityMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-full sm:w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-40 overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Выберите город Казахстана
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
                    {cityOptions.map((city) => {
                      const active = selectedCity === city;
                      return (
                        <button
                          key={city}
                          type="button"
                          onClick={() => handleSelectCity(city)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition ${
                            active
                              ? "bg-neutral-950 text-white font-medium"
                              : "text-neutral-700 hover:bg-slate-100"
                          }`}
                        >
                          <span>{city}</span>
                          {active && <Check className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Live Search Results */}
            <div className="mt-5">
              {searching && (
                <div className="py-5 text-sm text-slate-500">Ищем компании...</div>
              )}

              {!searching && hasSearched && businesses.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 text-sm text-slate-500">
                  По запросу «<strong className="text-neutral-800">{query}</strong>»
                  {selectedCity !== ALL_CITIES_LABEL ? ` в г. ${selectedCity}` : ""}{" "}
                  компаний пока не найдено.
                  {selectedCity !== ALL_CITIES_LABEL && (
                    <button
                      type="button"
                      onClick={() => handleSelectCity(ALL_CITIES_LABEL)}
                      className="block mt-2 text-xs font-semibold text-neutral-900 underline"
                    >
                      Искать по всему Казахстану
                    </button>
                  )}
                </div>
              )}

              {!searching && businesses.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                    Найденные компании ({businesses.length})
                  </div>
                  {businesses.map((b) => (
                    <Link
                      key={b.id}
                      href={`/${b.slug}`}
                      className="group flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 hover:border-neutral-900 hover:shadow-md transition"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center shrink-0">
                          <Store className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-base text-neutral-950 group-hover:text-blue-600 transition truncate">
                              {b.name}
                            </span>
                            {b.category && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium">
                                {b.category}
                              </span>
                            )}
                          </div>
                          {b.tagline && (
                            <p className="text-xs sm:text-sm text-slate-500 line-clamp-1 mt-0.5">
                              {b.tagline}
                            </p>
                          )}
                          {(b.city || b.address) && (
                            <div className="inline-flex items-center gap-1 text-xs text-slate-400 mt-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                {[b.city, b.address].filter(Boolean).join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-neutral-900">
                        Открыть
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <PhoneDemo />
          </div>
        </div>
      </main>

      {/* Bottom Business CTA */}
      <section className="bg-white border-t border-slate-200 py-8 px-4 mt-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5 bg-neutral-950 text-white rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-1">
              У вас свой бизнес или услуги?
            </h2>
            <p className="text-neutral-400 text-sm">
              Создайте платформу своего бизнеса в TIYIN Space: витрина по QR,
              каталог, база клиентов и TIYIN AI 24/7.
            </p>
          </div>
          <Link
            href={
              userEmail && (profile?.role === "business" || isAdmin)
                ? "/dashboard"
                : "/auth?mode=business&tab=register"
            }
            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-950 font-semibold text-sm sm:text-base transition"
          >
            <Building2 className="w-5 h-5" />
            <span>Создать платформу своего бизнеса</span>
          </Link>
        </div>
      </section>

      <SiteFooter showPricingSection={true} />
    </div>
  );
}
