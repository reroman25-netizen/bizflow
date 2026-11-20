"use client";

import React from "react";
import {
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  Send,
  ShoppingCart,
  Bot,
  Plus,
} from "lucide-react";

const DEMO_ITEMS = [
  {
    name: "Букет «Нежность»",
    desc: "Пионовидные розы, эвкалипт, авторская упаковка",
    price: "18 500 ₸",
    qty: 1,
  },
  {
    name: "Подарочный бокс Ameli",
    desc: "Свеча ручной работы, сладости и открытка",
    price: "12 000 ₸",
    qty: 0,
  },
  {
    name: "Композиция в шляпной коробке",
    desc: "Сезонные цветы, доставка за 45 минут",
    price: "24 000 ₸",
    qty: 0,
  },
];

export function PhoneDemo() {
  return (
    <div className="w-full max-w-[330px] mx-auto flex flex-col items-center">
      {/* Smartphone Frame */}
      <div className="w-full rounded-[2.6rem] bg-neutral-950 p-[10px] shadow-[0_24px_60px_-15px_rgba(15,23,42,0.28)] ring-1 ring-neutral-800">
        {/* Screen */}
        <div className="relative bg-slate-50 rounded-[2.1rem] overflow-hidden border border-neutral-800/40">
          {/* Top Notch / Status bar */}
          <div className="bg-white px-5 pt-2.5 pb-2 flex items-center justify-between text-[10px] font-semibold text-neutral-900">
            <span>09:41</span>
            <div className="w-16 h-4 rounded-full bg-neutral-950" />
            <span className="text-[9px] text-neutral-400">tiyin.kz</span>
          </div>

          {/* Storefront Mini Top Brand Strip */}
          <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-neutral-950 text-white text-[8px] font-extrabold flex items-center justify-center">
                T.S
              </span>
              <span className="text-[11px] font-bold text-neutral-900">
                TIYIN <span className="font-normal text-neutral-400">Space</span>
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
              Открыто
            </span>
          </div>

          {/* Business Header inside Phone */}
          <div className="bg-white px-4 py-3.5 border-b border-slate-200/80 space-y-2">
            <div>
              <div className="text-base font-bold text-neutral-950 leading-tight">
                Ameli Shop
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Авторские букеты и подарки
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                Алматы, пр. Достык 42
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                09:00 – 22:00
              </span>
            </div>

            <div className="flex gap-1.5 pt-0.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-semibold">
                <Phone className="w-2.5 h-2.5" />
                Позвонить
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                <MessageCircle className="w-2.5 h-2.5" />
                WhatsApp
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-[10px] font-semibold">
                <Send className="w-2.5 h-2.5" />
                Telegram
              </span>
            </div>
          </div>

          {/* Catalog Cards inside Phone */}
          <div className="p-3 space-y-2.5">
            <div className="flex gap-1.5 text-[10px] font-medium">
              <span className="px-2.5 py-1 rounded-full bg-neutral-950 text-white">
                Все
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
                Букеты
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
                Боксы
              </span>
            </div>

            {DEMO_ITEMS.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl p-2.5 border border-slate-200/80 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-neutral-900 truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                    {item.desc}
                  </div>
                  <div className="text-xs font-bold text-neutral-950 mt-1">
                    {item.price}
                  </div>
                </div>
                {item.qty > 0 ? (
                  <span className="shrink-0 px-2 py-1 rounded-lg bg-neutral-950 text-white text-[10px] font-semibold">
                    1 шт
                  </span>
                ) : (
                  <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-100 text-neutral-800 flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Bottom Floating Bar inside Phone */}
          <div className="px-3 pb-3.5 pt-1 flex items-center gap-2">
            <div className="flex-1 bg-neutral-950 text-white rounded-xl px-3 py-2 flex items-center justify-between text-[11px] font-semibold shadow-sm">
              <span className="inline-flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5" />
                Заказ (1)
              </span>
              <span>18 500 ₸</span>
            </div>
            <div className="bg-blue-600 text-white rounded-xl px-2.5 py-2 inline-flex items-center gap-1 text-[11px] font-semibold shadow-sm">
              <Bot className="w-3.5 h-3.5" />
              <span>ИИ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Neat Support & Subscription Links Below Phone */}
      <div className="w-full mt-5 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm text-center">
        <p className="text-xs font-semibold text-neutral-900 tracking-tight">
          Поддержка и подключение бизнеса
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
          По всем вопросам работы платформы и подписке
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <a
            href="https://wa.me/77067218599"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 text-emerald-800 text-xs font-semibold transition"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>WhatsApp</span>
          </a>
          <a
            href="https://t.me/tiyinkz"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200/70 text-sky-800 text-xs font-semibold transition"
          >
            <Send className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Telegram</span>
          </a>
        </div>
      </div>
    </div>
  );
}
