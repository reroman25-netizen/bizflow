"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Store, LayoutDashboard, QrCode, Bot, ArrowRight } from "lucide-react";
import { loadPlatformData } from "@/lib/storage";
import { BusinessProfile } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [notFoundMsg, setNotFoundMsg] = useState("");

  useEffect(() => {
    const data = loadPlatformData();
    setBusiness(data.business);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q || !business) return;

    if (
      q === business.slug.toLowerCase() ||
      business.name.toLowerCase().includes(q)
    ) {
      setNotFoundMsg("");
      router.push(`/${business.slug}`);
    } else {
      setNotFoundMsg(
        `Бизнес «${query}» пока не найден. Попробуйте ввести «${business.slug}» или «Айгерим».`
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg text-slate-900">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              B
            </div>
            <span>BizFlow KZ</span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Кабинет бизнеса</span>
          </Link>
        </div>
      </header>

      {/* Main Search Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium mb-4">
            <Bot className="w-3.5 h-3.5" />
            Прямой доступ к услугам без лишнего шума
          </span>

          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-3">
            Найдите нужный сервис или компанию
          </h1>
          <p className="text-slate-600 mb-8 text-sm sm:text-base">
            Введите название компании или короткий код, чтобы открыть меню,
            записаться или пообщаться с ИИ-ассистентом.
          </p>

          <form onSubmit={handleSearch} className="relative mb-3">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Например: Чебуречная у Айгерим или aigerim"
              className="w-full pl-12 pr-28 py-4 rounded-2xl border border-slate-300 bg-white shadow-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
            >
              Найти
            </button>
          </form>

          {notFoundMsg && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4">
              {notFoundMsg}
            </p>
          )}

          {/* Quick Demo Access */}
          {business && (
            <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-5 text-left shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Демо-доступ (уже подключено)
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Link
                  href={`/${business.slug}`}
                  className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-900">
                        {business.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        Витрина клиента (/{business.slug})
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                </Link>

                <Link
                  href="/dashboard"
                  className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-900">
                        Кабинет ИП
                      </div>
                      <div className="text-xs text-slate-500">
                        Товары, заказы, база, QR
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
