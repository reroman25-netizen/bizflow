"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, ShieldCheck, FileText, Lock } from "lucide-react";
import {
  LEGAL_DOCUMENTS,
  LegalDocKey,
  LegalLang,
  TIYIN_LEGAL_REQUISITES,
} from "@/lib/legalDocs";
import { BrandLogo } from "@/components/BrandLogo";

interface LegalDocumentViewProps {
  docKey: LegalDocKey;
}

const DOC_TABS: { key: LegalDocKey; href: string; labelRu: string; labelKz: string }[] = [
  { key: "offer", href: "/offer", labelRu: "Оферта (Бизнесу)", labelKz: "Оферта (Бизнеске)" },
  { key: "terms", href: "/terms", labelRu: "Соглашение (Клиентам)", labelKz: "Келісім (Клиенттерге)" },
  { key: "privacy", href: "/privacy", labelRu: "Конфиденциальность", labelKz: "Құпиялылық" },
];

function applyRequisites(text: string): string {
  const r = TIYIN_LEGAL_REQUISITES;
  return text
    .replaceAll("[ИП / ТОО «Указать наименование»]", r.companyNameRu)
    .replaceAll("[ЖК / ЖШС «Атауын көрсетіңіз»]", r.companyNameKz)
    .replaceAll("[Указать 12 цифр]", r.iinBin)
    .replaceAll("[12 таңбалы нөмірді көрсетіңіз]", r.iinBin)
    .replaceAll("Республика Казахстан, г. Алматы, [ул. ..., д. ..., офис ...]", r.addressRu)
    .replaceAll("Республика Казахстан, г. Алматы, [ул. ..., д. ...]", r.addressRu)
    .replaceAll("Қазақстан Республикасы, Алматы қ., [... көшесі, ... үй, ... кеңсе]", r.addressKz)
    .replaceAll("Қазақстан Республикасы, Алматы қ., [... көшесі, ... үй]", r.addressKz)
    .replaceAll("[KZ...]", r.iban)
    .replaceAll("[АО «Народный Банк Казахстана»]", r.bankRu)
    .replaceAll("[«Қазақстан Халық Банкі» АҚ]", r.bankKz)
    .replaceAll("[HSBKKZKX]", r.bik)
    .replaceAll("[19/17]", r.kbe)
    .replaceAll("[support@tiyin.kz]", r.email)
    .replaceAll("[+7 706 721 85 99]", r.phone);
}

export function LegalDocumentView({ docKey }: LegalDocumentViewProps) {
  const [lang, setLang] = useState<LegalLang>("ru");
  const doc = LEGAL_DOCUMENTS[docKey][lang];

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-neutral-900 pb-16">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-neutral-800 transition shrink-0"
              aria-label="На главную"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <BrandLogo size="sm" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setLang("ru")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  lang === "ru"
                    ? "bg-neutral-950 text-white shadow-sm"
                    : "text-slate-600 hover:text-neutral-950"
                }`}
              >
                РУС
              </button>
              <button
                type="button"
                onClick={() => setLang("kz")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  lang === "kz"
                    ? "bg-neutral-950 text-white shadow-sm"
                    : "text-slate-600 hover:text-neutral-950"
                }`}
              >
                ҚАЗ
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-neutral-800 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{lang === "ru" ? "Печать / PDF" : "Басып шығару"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {DOC_TABS.map((t) => {
            const active = t.key === docKey;
            return (
              <Link
                key={t.key}
                href={t.href}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 ${
                  active
                    ? "bg-neutral-950 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.key === "offer" && <FileText className="w-3.5 h-3.5" />}
                {t.key === "terms" && <ShieldCheck className="w-3.5 h-3.5" />}
                {t.key === "privacy" && <Lock className="w-3.5 h-3.5" />}
                <span>{lang === "ru" ? t.labelRu : t.labelKz}</span>
              </Link>
            );
          })}
        </div>

        <article className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="bg-neutral-950 text-white px-6 py-6 sm:px-8 sm:py-7 space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TIYIN Space · tiyin.kz
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {doc.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {doc.subtitle}
            </p>
            <div className="text-[11px] text-slate-400 pt-1">{doc.meta}</div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200/70 rounded-2xl p-4">
              {applyRequisites(doc.intro)}
            </p>

            {doc.sections.map((section, idx) => (
              <section key={idx} className="space-y-2.5">
                <h2 className="text-base font-bold text-neutral-950">
                  {section.heading}
                </h2>
                <div className="space-y-2">
                  {section.paragraphs.map((para, pIdx) => (
                    <p
                      key={pIdx}
                      className="text-sm text-slate-700 leading-relaxed"
                    >
                      {applyRequisites(para)}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}
