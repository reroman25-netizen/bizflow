"use client";

import Link from "next/link";
import { ShieldCheck, Phone, Mail, Send, MapPin, Clock, Check, Sparkles, Zap } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { TIYIN_LEGAL_REQUISITES } from "@/lib/legalDocs";
import { AI_AUTOPILOT_MONTHLY_PRICE } from "@/lib/subscriptionPlans";
import {
  SAAS_BASE_MONTHLY_PRICE,
  SAAS_BASE_TRIAL_MONTHS,
  SAAS_PRO_MONTHLY_PRICE,
} from "@/lib/proPlan";
import { formatKZT } from "@/lib/format";

interface SiteFooterProps {
  showPricingSection?: boolean;
}

export function SiteFooter({ showPricingSection = true }: SiteFooterProps) {
  const r = TIYIN_LEGAL_REQUISITES;

  return (
    <div className="w-full">
      {showPricingSection && (
        <section
          id="pricing"
          className="max-w-5xl mx-auto px-4 py-12 sm:py-16 space-y-6"
        >
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Чистый SaaS · 0% комиссии с ваших продаж</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
              Тарифы платформы TIYIN Space
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Облачное программное обеспечение для бизнеса в Казахстане: витрина, PWA-приложение,
              Telegram Mini App, прямые API-интеграции с банками и Яндекс Доставкой, ИИ-ассистент 24/7.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Plan 1: Base 990 ₸ */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Базовый
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-neutral-950">
                    {formatKZT(SAAS_BASE_MONTHLY_PRICE)}
                    <span className="text-sm font-medium text-slate-500"> / мес</span>
                  </div>
                  <div className="text-xs font-semibold text-emerald-700 mt-1">
                    Первые {SAAS_BASE_TRIAL_MONTHS} месяца — бесплатно (0 ₸)
                  </div>
                </div>
                <ul className="space-y-2 text-xs text-slate-600 pt-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Витрина tiyin.kz/ваш-бизнес, QR-код и PWA-приложение</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Каталог товаров/услуг, фото, видео-слайды и база клиентов</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Kaspi Pay по ссылке (с загрузкой чека) и заказы в Telegram</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Отображение условий доставки на витрине · 0% с продаж</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/auth?mode=business&tab=register"
                className="w-full py-3 rounded-2xl border border-slate-300 hover:bg-slate-50 text-neutral-950 text-xs font-bold text-center transition"
              >
                Попробовать 3 месяца бесплатно
              </Link>
            </div>

            {/* Plan 2: Business PRO 4 990 ₸ */}
            <div className="bg-white rounded-3xl border-2 border-neutral-950 p-6 shadow-md flex flex-col justify-between space-y-5 relative">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-600">
                    <Zap className="w-3.5 h-3.5" />
                    Бизнес PRO
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-neutral-950 text-white text-[10px] font-bold">
                    Хит для доставки
                  </span>
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-neutral-950">
                    {formatKZT(SAAS_PRO_MONTHLY_PRICE)}
                    <span className="text-sm font-medium text-slate-500"> / мес</span>
                  </div>
                  <div className="text-xs font-semibold text-emerald-700 mt-1">
                    1 месяц бесплатно при подключении или переходе
                  </div>
                </div>
                <ul className="space-y-2 text-xs text-slate-700 pt-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Всё из тарифа «Базовый»</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>API банков (Halyk ePay, Freedom Pay)</strong> — авто-оплата картами и Apple/Google Pay напрямую на ваш счёт
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>API Яндекс Доставки (свой токен)</strong> — вызов курьера в 1 клик из кабинета и Telegram
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Живой трекинг курьера на карте для клиента · 0% наценки</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/auth?mode=business&tab=register"
                className="w-full py-3 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold text-center transition"
              >
                Включить PRO (1 мес. бесплатно)
              </Link>
            </div>

            {/* Plan 3: TIYIN AI */}
            <div className="bg-neutral-950 text-white rounded-3xl border border-neutral-800 p-6 shadow-md flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-blue-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    TIYIN AI
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                    24/7
                  </span>
                </div>
                <div>
                  <div className="text-3xl font-extrabold">
                    {formatKZT(AI_AUTOPILOT_MONTHLY_PRICE)}
                    <span className="text-sm font-medium text-slate-400"> / мес</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Всё из «Бизнес PRO» + ИИ-продавец 24/7
                  </div>
                </div>
                <ul className="space-y-2 text-xs text-slate-300 pt-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>Все функции тарифа «Бизнес PRO» (API банков + Яндекс Доставка)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>ИИ-ассистент на витрине с маркировкой по Закону РК об ИИ</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>Консультации по каталогу и авто-оформление заказов 24/7</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>Подключение WhatsApp, Instagram и Telegram + пауза ИИ</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/auth?mode=business&tab=register"
                className="w-full py-3 rounded-2xl bg-white hover:bg-slate-100 text-neutral-950 text-xs font-bold text-center transition"
              >
                Подключить TIYIN AI
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* OFFICIAL LEGAL FOOTER */}
      <footer className="bg-white border-t border-slate-200/90 text-slate-600">
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs">
            <div className="space-y-3">
              <BrandLogo size="sm" />
              <p className="text-slate-500 leading-relaxed">
                TIYIN Space — облачная SaaS-платформа для бизнеса в Казахстане: витрины,
                PWA-приложения, техническая API-интеграция банков и Яндекс Доставки, ИИ-ассистент.
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Платформа не является продавцом товаров, платёжной организацией или перевозчиком.
                Все расчёты за товары и доставку происходят напрямую между участниками.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="font-bold text-neutral-950 uppercase tracking-wider text-[11px]">
                О компании и реквизиты
              </div>
              <div className="space-y-1.5 text-slate-600">
                <div className="font-semibold text-neutral-900">{r.companyNameRu}</div>
                <div className="font-mono text-[11px]">ИИН/БИН: {r.iinBin}</div>
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{r.addressRu}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>Поддержка: {r.workingHours}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="font-bold text-neutral-950 uppercase tracking-wider text-[11px]">
                Контакты и поддержка
              </div>
              <div className="space-y-2">
                <a
                  href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}
                  className="flex items-center gap-2 hover:text-neutral-950 transition"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{r.phone}</span>
                </a>
                <a
                  href={`mailto:${r.email}`}
                  className="flex items-center gap-2 hover:text-neutral-950 transition"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{r.email}</span>
                </a>
                <a
                  href={r.telegramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-neutral-950 transition"
                >
                  <Send className="w-3.5 h-3.5 text-sky-500" />
                  <span>Telegram: {r.telegram}</span>
                </a>
                <a
                  href={r.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-neutral-950 transition"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp: {r.whatsapp}</span>
                </a>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="font-bold text-neutral-950 uppercase tracking-wider text-[11px]">
                Правовые документы (РУС / ҚАЗ)
              </div>
              <div className="flex flex-col space-y-2">
                <Link href="/offer" className="hover:text-neutral-950 underline">
                  Оферта SaaS для бизнеса (B2B)
                </Link>
                <Link href="/terms" className="hover:text-neutral-950 underline">
                  Пользовательское соглашение (B2C)
                </Link>
                <Link href="/privacy" className="hover:text-neutral-950 underline">
                  Политика конфиденциальности (№ 94-V)
                </Link>
                <Link href="/auth?mode=business&tab=register" className="hover:text-neutral-950">
                  Регистрация бизнеса →
                </Link>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[11px] text-slate-400">
            <div>
              © {new Date().getFullYear()} TIYIN Space ({r.companyNameRu}). Все права защищены.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 font-bold text-slate-700">
                VISA
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 font-bold text-slate-700">
                Mastercard
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/70 font-bold text-[#00805F]">
                Halyk ePay
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/70 font-bold text-[#00B140]">
                Freedom Pay
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200/70 font-bold text-[#F14635]">
                Kaspi Pay
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
