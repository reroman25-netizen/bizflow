"use client";

import Link from "next/link";

interface LegalConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  mode?: "business" | "client";
}

export function LegalConsentCheckbox({
  checked,
  onChange,
  mode = "business",
}: LegalConsentCheckboxProps) {
  return (
    <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 rounded border-slate-300 accent-neutral-950 shrink-0"
        required
      />
      <span className="leading-relaxed">
        Я принимаю условия{" "}
        {mode === "business" ? (
          <Link
            href="/offer"
            target="_blank"
            className="font-semibold text-neutral-950 underline"
          >
            Оферты для бизнеса
          </Link>
        ) : (
          <Link
            href="/terms"
            target="_blank"
            className="font-semibold text-neutral-950 underline"
          >
            Пользовательского соглашения
          </Link>
        )}{" "}
        и{" "}
        <Link
          href="/privacy"
          target="_blank"
          className="font-semibold text-neutral-950 underline"
        >
          Политики конфиденциальности
        </Link>
        , а также даю согласие на обработку и трансграничную передачу персональных
        данных (Telegram, Google AI) в объёме, необходимом для работы сервиса (Закон РК
        № 94-V).
      </span>
    </label>
  );
}
