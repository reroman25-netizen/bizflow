"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Truck,
  Save,
  MapPin,
  Navigation,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  Lock,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Business, DeliveryPricingMode } from "@/lib/types";
import { evaluateClientDelivery } from "@/lib/deliveryPricing";
import {
  canActivateFreeProTrial,
  hasActiveProAccess,
  SAAS_PRO_MONTHLY_PRICE,
} from "@/lib/proPlan";
import { formatKZT } from "@/lib/format";

interface YandexDeliverySettingsProps {
  accessToken: string;
  business: Business;
  onBusinessUpdate: (patch: Partial<Business>) => void;
  onNotice: (msg: string) => void;
  onActivateProTrial: () => Promise<void>;
  activatingPro: boolean;
}

export function YandexDeliverySettings({
  accessToken,
  business,
  onBusinessUpdate,
  onNotice,
  onActivateProTrial,
  activatingPro,
}: YandexDeliverySettingsProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Storefront display settings (available on ALL plans including Base 990 ₸)
  const [enabled, setEnabled] = useState(Boolean(business.delivery_enabled));
  const [pricingMode, setPricingMode] = useState<DeliveryPricingMode>(
    business.delivery_pricing_mode === "included" ? "included" : "fixed"
  );
  const [fixedPrice, setFixedPrice] = useState(
    business.delivery_fixed_price ? String(business.delivery_fixed_price) : "800"
  );
  const [freeFrom, setFreeFrom] = useState(
    business.delivery_free_from ? String(business.delivery_free_from) : ""
  );
  const [minOrder, setMinOrder] = useState(
    business.delivery_min_order ? String(business.delivery_min_order) : ""
  );
  const [showIncludedBadge, setShowIncludedBadge] = useState(
    business.delivery_show_included_badge !== false
  );

  // BYOK Yandex Delivery API settings (PRO / TIYIN AI only)
  const [apiEnabled, setApiEnabled] = useState(Boolean(business.delivery_api_enabled));
  const [yandexToken, setYandexToken] = useState("");
  const [yandexHasToken, setYandexHasToken] = useState(false);
  const [yandexTestMode, setYandexTestMode] = useState(false);
  const [showYandexGuide, setShowYandexGuide] = useState(false);

  // Pickup point (Point A)
  const [pickupAddress, setPickupAddress] = useState(
    business.delivery_pickup_address ||
      [business.city, business.address].filter(Boolean).join(", ")
  );
  const [pickupLat, setPickupLat] = useState(
    business.delivery_pickup_lat != null ? String(business.delivery_pickup_lat) : ""
  );
  const [pickupLng, setPickupLng] = useState(
    business.delivery_pickup_lng != null ? String(business.delivery_pickup_lng) : ""
  );
  const [pickupEntrance, setPickupEntrance] = useState(
    business.delivery_pickup_entrance || ""
  );
  const [pickupPhone, setPickupPhone] = useState(
    business.delivery_pickup_phone || business.phone || ""
  );
  const [pickupComment, setPickupComment] = useState(
    business.delivery_pickup_comment || ""
  );
  const [locating, setLocating] = useState(false);

  const proActive = hasActiveProAccess(business);
  const canTryPro = canActivateFreeProTrial(business);

  const loadDeliveryData = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/dashboard/delivery", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.settings) {
        const s = json.settings;
        setEnabled(Boolean(s.delivery_enabled));
        setApiEnabled(Boolean(s.delivery_api_enabled));
        setYandexHasToken(Boolean(s.yandex_has_token));
        setYandexTestMode(Boolean(s.yandex_test_mode));
        setPricingMode(s.delivery_pricing_mode === "included" ? "included" : "fixed");
        setFixedPrice(
          s.delivery_fixed_price !== undefined ? String(s.delivery_fixed_price) : "800"
        );
        setFreeFrom(s.delivery_free_from ? String(s.delivery_free_from) : "");
        setMinOrder(s.delivery_min_order ? String(s.delivery_min_order) : "");
        setShowIncludedBadge(s.delivery_show_included_badge !== false);
        setPickupAddress(s.delivery_pickup_address || "");
        setPickupLat(s.delivery_pickup_lat != null ? String(s.delivery_pickup_lat) : "");
        setPickupLng(s.delivery_pickup_lng != null ? String(s.delivery_pickup_lng) : "");
        setPickupEntrance(s.delivery_pickup_entrance || "");
        setPickupPhone(s.delivery_pickup_phone || "");
        setPickupComment(s.delivery_pickup_comment || "");
      }
    } catch {
      // ignore
    }
  }, [accessToken]);

  useEffect(() => {
    loadDeliveryData();
  }, [loadDeliveryData]);

  const handleDetectLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Геолокация не поддерживается в этом браузере. Введите координаты вручную.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickupLat(pos.coords.latitude.toFixed(6));
        setPickupLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
        onNotice("Координаты вашей точки забора определены!");
      },
      () => {
        setLocating(false);
        setError("Не удалось получить геолокацию. Скопируйте координаты из 2GIS или Яндекс Карт.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/delivery", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          delivery_enabled: enabled,
          delivery_api_enabled: proActive ? apiEnabled : false,
          yandex_api_token: yandexToken.trim(),
          yandex_test_mode: yandexTestMode,
          delivery_pricing_mode: pricingMode,
          delivery_fixed_price: Number(fixedPrice || 0),
          delivery_free_from: freeFrom.trim() ? Number(freeFrom) : null,
          delivery_min_order: minOrder.trim() ? Number(minOrder) : null,
          delivery_show_included_badge: showIncludedBadge,
          delivery_pickup_address: pickupAddress.trim(),
          delivery_pickup_lat: pickupLat.trim() ? Number(pickupLat) : null,
          delivery_pickup_lng: pickupLng.trim() ? Number(pickupLng) : null,
          delivery_pickup_entrance: pickupEntrance.trim(),
          delivery_pickup_phone: pickupPhone.trim(),
          delivery_pickup_comment: pickupComment.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Не удалось сохранить настройки доставки.");
        return;
      }
      if (json.settings) {
        setYandexHasToken(Boolean(json.settings.yandex_has_token));
        setYandexToken("");
        onBusinessUpdate(json.settings);
      }
      onNotice("Настройки доставки сохранены и уже активны!");
    } catch {
      setError("Ошибка сети при сохранении настроек доставки.");
    } finally {
      setSaving(false);
    }
  };

  const previewEval = evaluateClientDelivery(
    {
      delivery_enabled: true,
      delivery_pricing_mode: pricingMode,
      delivery_fixed_price: Number(fixedPrice || 0),
      delivery_free_from: freeFrom.trim() ? Number(freeFrom) : null,
      delivery_min_order: minOrder.trim() ? Number(minOrder) : null,
      delivery_show_included_badge: showIncludedBadge,
    },
    2500
  );

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-950">
          Доставка и Яндекс Курьер (API)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Условия доставки для клиентов на витрине и авто-вызов курьеров через ваш аккаунт Яндекс Доставки
        </p>
      </div>

      {/* Explainer card */}
      <div className="rounded-3xl bg-gradient-to-br from-neutral-950 to-slate-900 text-white p-5 shadow-sm space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
          <Truck className="w-4 h-4" />
          <span>Как работает интеграция Яндекс Доставки</span>
        </div>
        <p className="text-xs text-white/85 leading-relaxed">
          Вы подключаете свой собственный API-токен из кабинета <strong>Яндекс Доставки для бизнеса</strong> —
          никаких наценок от TIYIN и лишних пополнений. Оплата поездок списывается напрямую с вашего счёта в Яндексе,
          а курьер вызывается в 1 клик из кабинета или Telegram строго по вашей команде, когда заказ готов.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-4">
        {/* 1. CLIENT DELIVERY RULES ON STOREFRONT (ALL PLANS) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-sm sm:text-base text-neutral-950">
                Показывать условия доставки на витрине
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Доступно на всех тарифах: клиент сразу видит цену доставки и порог бесплатной доставки
              </div>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
              <span className="text-xs font-semibold text-slate-600">
                {enabled ? "Вкл" : "Выкл"}
              </span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 accent-neutral-950"
              />
            </label>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPricingMode("fixed")}
                className={`text-left p-3.5 rounded-2xl border-2 transition ${
                  pricingMode === "fixed"
                    ? "border-neutral-950 bg-neutral-50"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-neutral-950">
                    Фиксированная цена
                  </span>
                  {pricingMode === "fixed" && (
                    <span className="px-2 py-0.5 rounded-full bg-neutral-950 text-white text-[10px] font-semibold">
                      Выбрано
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Например: 800 ₸, а при заказе от 7 000 ₸ — бесплатно.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPricingMode("included")}
                className={`text-left p-3.5 rounded-2xl border-2 transition ${
                  pricingMode === "included"
                    ? "border-neutral-950 bg-neutral-50"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-neutral-950">
                    Включена в стоимость
                  </span>
                  {pricingMode === "included" && (
                    <span className="px-2 py-0.5 rounded-full bg-neutral-950 text-white text-[10px] font-semibold">
                      Выбрано
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Клиент не платит за доставку отдельно (можно задать мин. сумму заказа).
                </p>
              </button>
            </div>

            {pricingMode === "fixed" ? (
              <div className="grid sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Цена доставки (₸)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={fixedPrice}
                    onChange={(e) => setFixedPrice(e.target.value)}
                    placeholder="800"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Бесплатно от (₸)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={freeFrom}
                    onChange={(e) => setFreeFrom(e.target.value)}
                    placeholder="Напр. 7000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Мин. сумма заказа (₸)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    placeholder="Необязательно"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-2xl px-3.5 py-2.5 border border-slate-200/70">
                  <div>
                    <div className="text-xs font-semibold text-neutral-900">
                      Показывать пометку «Доставка включена в стоимость»
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Если выключить — просто не показываем цену доставки клиенту
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showIncludedBadge}
                    onChange={(e) => setShowIncludedBadge(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 accent-neutral-950 shrink-0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Минимальная сумма заказа для доставки (₸)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    placeholder="Например: 3000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/70 px-3.5 py-2.5 flex items-center gap-2 text-xs text-emerald-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="text-emerald-800">Так увидит клиент: </span>
                <strong className="font-semibold">{previewEval.summaryLine}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* 2. YANDEX DELIVERY BYOK API SECTION (PRO / TIYIN AI) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-amber-400 text-neutral-950 font-extrabold text-sm flex items-center justify-center shrink-0">
                Я
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm sm:text-base text-neutral-950">
                    Яндекс Доставка (ваш API-токен)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-neutral-950 text-white text-[10px] font-bold">
                    PRO
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Вызов курьеров в 1 клик из кабинета и Telegram + карта отслеживания для клиента
                </div>
              </div>
            </div>

            {proActive && (
              <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                <span className="text-xs font-semibold text-slate-600">
                  {apiEnabled ? "Вкл" : "Выкл"}
                </span>
                <input
                  type="checkbox"
                  checked={apiEnabled}
                  onChange={(e) => setApiEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 accent-neutral-950"
                />
              </label>
            )}
          </div>

          {!proActive ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-200/90 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-xs sm:text-sm text-amber-950">
                    Доступно на тарифе «Бизнес PRO» ({formatKZT(SAAS_PRO_MONTHLY_PRICE)}/мес)
                  </div>
                  <p className="text-xs text-amber-900/85 leading-relaxed">
                    На PRO открываются сразу обе автоматизации: авто-вызов курьеров через ваш
                    API Яндекс Доставки и авто-оплата через API банков Halyk ePay / Freedom Pay.
                  </p>
                </div>
              </div>

              {canTryPro ? (
                <button
                  type="button"
                  disabled={activatingPro}
                  onClick={onActivateProTrial}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold transition shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {activatingPro
                      ? "Включаем PRO..."
                      : "Попробовать Бизнес PRO бесплатно на 1 месяц"}
                  </span>
                </button>
              ) : (
                <a
                  href="https://t.me/tiyinkz"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition"
                >
                  <span>Продлить Бизнес PRO в Telegram</span>
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* Test / Production mode toggle */}
              <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-2xl px-3.5 py-2.5 border border-slate-200/70">
                <div>
                  <div className="text-xs font-semibold text-neutral-900">
                    Контур Яндекс Доставки
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {yandexTestMode
                      ? "Тестовый контур (b2b.taxi.tst.yandex.net)"
                      : "Боевой контур (b2b.taxi.yandex.net — реальные курьеры)"}
                  </div>
                </div>
                <div className="inline-flex p-0.5 rounded-xl bg-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setYandexTestMode(true)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      yandexTestMode ? "bg-white text-neutral-950 shadow-sm" : "text-slate-600"
                    }`}
                  >
                    Тест
                  </button>
                  <button
                    type="button"
                    onClick={() => setYandexTestMode(false)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      !yandexTestMode ? "bg-neutral-950 text-white shadow-sm" : "text-slate-600"
                    }`}
                  >
                    Боевой
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Ваш API-токен Яндекс Доставки для бизнеса</span>
                  </label>
                  {yandexHasToken && (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Токен сохранён (AES-256)
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  value={yandexToken}
                  onChange={(e) => setYandexToken(e.target.value)}
                  placeholder={
                    yandexHasToken
                      ? "Оставьте пустым, чтобы не менять сохранённый токен"
                      : "Вставьте OAuth-токен из кабинета Яндекс Доставки"
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Токен шифруется на сервере алгоритмом AES-256-GCM и недоступен из браузера.</span>
                </p>
              </div>

              {/* Collapsible 3-step guide */}
              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowYandexGuide((prev) => !prev)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-amber-950"
                >
                  <span>Как получить API-токен в Яндекс Доставке для бизнеса (3 шага)</span>
                  {showYandexGuide ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showYandexGuide && (
                  <div className="px-3.5 pb-3.5 text-[11px] text-amber-950 space-y-1.5 leading-relaxed border-t border-amber-200/50 pt-2.5">
                    <div>
                      1. Зарегистрируйте корпоративный кабинет на <strong>dostavka.yandex.kz/business</strong> (на ваше ИП или ТОО) и пополните баланс.
                    </div>
                    <div>
                      2. В личном кабинете Яндекса откройте раздел <strong>«Интеграция / API»</strong> и нажмите <strong>«Получить токен»</strong>.
                    </div>
                    <div>
                      3. Вставьте токен в поле выше, заполните точку забора ниже, включите переключатель и нажмите <strong>Сохранить</strong>.
                    </div>
                  </div>
                )}
              </div>

              {/* Pickup point (Point A) */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Точка забора заказов (Точка А)</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Точный адрес забора (город, улица, дом)
                  </label>
                  <input
                    type="text"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Алматы, ул. Абая 50"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Вход / подъезд / этаж
                    </label>
                    <input
                      type="text"
                      value={pickupEntrance}
                      onChange={(e) => setPickupEntrance(e.target.value)}
                      placeholder="Вход со двора, 1 этаж"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Телефон для курьера
                    </label>
                    <input
                      type="tel"
                      value={pickupPhone}
                      onChange={(e) => setPickupPhone(e.target.value)}
                      placeholder="+7 707 123 45 67"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Комментарий курьеру
                  </label>
                  <input
                    type="text"
                    value={pickupComment}
                    onChange={(e) => setPickupComment(e.target.value)}
                    placeholder="Сказать номер заказа на кассе"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-neutral-800">
                      GPS-координаты точки А
                    </div>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={locating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-neutral-900 transition"
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-600" />
                      <span>{locating ? "Определяем..." : "Определить по GPS"}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={pickupLat}
                      onChange={(e) => setPickupLat(e.target.value)}
                      placeholder="Широта (43.238949)"
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                    />
                    <input
                      type="text"
                      value={pickupLng}
                      onChange={(e) => setPickupLng(e.target.value)}
                      placeholder="Долгота (76.889709)"
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition shadow-sm"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Сохраняем..." : "Сохранить настройки доставки"}</span>
        </button>
      </form>
    </div>
  );
}
