"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  Send,
  ShoppingCart,
  Plus,
  Minus,
  Bot,
  X,
  CheckCircle2,
  ArrowLeft,
  CreditCard,
  Truck,
  Copy,
  Check,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Business, Product } from "@/lib/types";
import { formatKZT, cleanPhoneForWa, cleanTelegramHandle } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

interface OrderResult {
  orderCode: string;
  totalPrice: number;
  paymentMethod: string;
  deliveryMethod: string;
}

const DELIVERY_OPTIONS = [
  {
    id: "Самовывоз",
    label: "Самовывоз",
    hint: "Забрать по адресу компании",
  },
  {
    id: "Доставка курьером",
    label: "Доставка курьером",
    hint: "Условия и стоимость уточнит менеджер",
  },
  {
    id: "Услуга / Запись",
    label: "Услуга на месте / Онлайн",
    hint: "Для салонов, СТО, клиник и сервисов",
  },
];

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed;
}

function getOrCreateChatSessionId(businessId: string): string {
  if (typeof window === "undefined") return "web-guest";
  const key = `tiyin_chat_session_${businessId}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const generated =
    "web-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10);
  window.localStorage.setItem(key, generated);
  return generated;
}

export default function BusinessStorefrontPage() {
  const params = useParams();
  const slug = String(params?.slug || "");

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("Оплата при получении / Уточнить");
  const [deliveryMethod, setDeliveryMethod] = useState("Самовывоз");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("+7 ");
  const [comment, setComment] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState("web-guest");
  const [chatOrderBanner, setChatOrderBanner] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: "Здравствуйте! Я ИИ-помощник компании. Подсказать по услугам, ценам или помочь оформить заказ?",
    },
  ]);

  useEffect(() => {
    const loadStorefront = async () => {
      const supabase = getSupabaseClient();

      const { data: sess } = await supabase.auth.getSession();
      if (sess.session?.user) {
        setUserId(sess.session.user.id);
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", sess.session.user.id)
          .maybeSingle();
        if (prof?.full_name) setClientName(prof.full_name);
      }

      const { data: biz } = await supabase
        .from("businesses")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (!biz) {
        setBusiness(null);
        setLoading(false);
        return;
      }

      const typedBiz = biz as Business;
      setBusiness(typedBiz);
      setChatSessionId(getOrCreateChatSessionId(typedBiz.id));

      // Устанавливаем способ оплаты по умолчанию в зависимости от настроек бизнеса
      if (typedBiz.kaspi_pay_link?.trim()) {
        setPaymentMethod("Kaspi Pay");
      } else if (typedBiz.halyk_enabled) {
        setPaymentMethod("Halyk Bank");
      } else {
        setPaymentMethod("Оплата при получении / Уточнить");
      }

      const [prodRes, aiRes] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("business_id", typedBiz.id)
          .eq("is_available", true)
          .order("created_at", { ascending: false }),
        fetch(`/api/ai-status?businessId=${typedBiz.id}`),
      ]);

      setProducts((prodRes.data as Product[]) || []);
      if (aiRes.ok) {
        const aiJson = await aiRes.json();
        setAiEnabled(Boolean(aiJson.ai_enabled));
      }

      setLoading(false);
    };

    if (slug) loadStorefront();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Загрузка витрины...
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-[#FAFAFB]">
        <h1 className="text-2xl font-bold text-neutral-950 mb-2">Компания не найдена</h1>
        <p className="text-sm text-slate-500 mb-6">
          Проверьте ссылку или найдите нужную компанию через поиск.
        </p>
        <Link
          href="/"
          className="px-5 py-3 rounded-xl bg-neutral-950 text-white text-sm font-semibold"
        >
          Перейти к поиску
        </Link>
      </div>
    );
  }

  const kaspiLink = normalizeUrl(business.kaspi_pay_link || "");
  const hasKaspi = Boolean(kaspiLink);
  const hasHalyk = Boolean(business.halyk_enabled);

  const paymentOptions: {
    id: string;
    label: string;
    hint: string;
    badge?: "kaspi" | "halyk";
  }[] = [];

  if (hasKaspi) {
    paymentOptions.push({
      id: "Kaspi Pay",
      label: "Kaspi Pay",
      hint: "Переход по ссылке в приложение Kaspi.kz",
      badge: "kaspi",
    });
  }
  if (hasHalyk) {
    paymentOptions.push({
      id: "Halyk Bank",
      label: "Halyk Bank",
      hint: "Оплата через Halyk QR / карту (менеджер подтвердит)",
      badge: "halyk",
    });
  }
  paymentOptions.push({
    id: "Оплата при получении / Уточнить",
    label: "Оплата при получении / Уточнить",
    hint: "Наличными или по согласованию с менеджером",
  });

  const categories = [
    "Все",
    ...Array.from(new Set(products.map((p) => p.category || "Услуги"))),
  ];
  const filteredProducts =
    selectedCategory === "Все"
      ? products
      : products.filter((p) => (p.category || "Услуги") === selectedCategory);

  const addToCart = (id: string) =>
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));

  const removeFromCart = (id: string) =>
    setCart((prev) => {
      const next = { ...prev };
      if (!next[id] || next[id] <= 1) delete next[id];
      else next[id] -= 1;
      return next;
    });

  const deleteFromCart = (id: string) =>
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const handleBuyNow = (id: string) => {
    setCart((prev) => ({ ...prev, [id]: prev[id] ? prev[id] : 1 }));
    setOrderError("");
    setCheckoutOpen(true);
  };

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => {
      const prod = products.find((p) => p.id === id);
      if (!prod) return null;
      return { productId: prod.id, name: prod.name, price: prod.price, quantity: qty };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim() || cartItems.length === 0) return;
    setSubmittingOrder(true);
    setOrderError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          userId,
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          comment: comment.trim(),
          paymentMethod,
          deliveryMethod,
          source: "web",
          items: cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setCart({});
        setCheckoutOpen(false);
        setOrderResult({
          orderCode: json.orderCode || "ORD",
          totalPrice: Number(json.totalPrice ?? cartTotal),
          paymentMethod,
          deliveryMethod,
        });
      } else {
        setOrderError(json.error || "Не удалось оформить заказ. Попробуйте еще раз.");
      }
    } catch {
      setOrderError("Ошибка сети. Проверьте интернет и попробуйте снова.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          sessionId: chatSessionId,
          clientName: clientName.trim() || undefined,
          message: text,
        }),
      });
      const json = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: json.reply || "Готов помочь!" },
      ]);
      if (json.orderCreated?.orderCode) {
        setChatOrderBanner(
          `Заказ ${json.orderCreated.orderCode} на ${formatKZT(
            json.orderCreated.totalPrice
          )} оформлен через TIYIN AI`
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Ошибка связи. Попробуйте еще раз." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const locationLabel = [business.city, business.address].filter(Boolean).join(", ");
  const waNumber = cleanPhoneForWa(business.whatsapp || business.phone || "");

  const buildWhatsappReceiptUrl = (res: OrderResult) => {
    if (!waNumber) return "";
    const text =
      res.paymentMethod === "Kaspi Pay"
        ? `Здравствуйте! Оплатил(а) заказ ${res.orderCode} на сумму ${formatKZT(
            res.totalPrice
          )} (${res.deliveryMethod}), отправляю чек.`
        : `Здравствуйте! Оформил(а) заказ ${res.orderCode} на сумму ${formatKZT(
            res.totalPrice
          )} (${res.paymentMethod}, ${res.deliveryMethod}).`;
    return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] pb-28">
      {/* Storefront Header (ONLY this business) */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-neutral-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Поиск компаний
            </Link>
            <Link href="/" className="opacity-80 hover:opacity-100 transition">
              <BrandLogo size="sm" />
            </Link>
          </div>

          <div className="pt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-neutral-950">{business.name}</h1>
                {business.category && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                    {business.category}
                  </span>
                )}
              </div>
              {business.tagline && (
                <p className="text-sm text-slate-600 mt-1">{business.tagline}</p>
              )}
            </div>

            {/* Аккуратные значки банков — видны ТОЛЬКО если бизнес подключил их в настройках оплаты */}
            {(hasKaspi || hasHalyk) && (
              <div className="flex items-center gap-1.5 pt-0.5">
                {hasKaspi && (
                  <span
                    title="Принимаем оплату через Kaspi Pay"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-50/80 border border-red-200/70 text-[11px] font-semibold text-neutral-900"
                  >
                    <span className="w-4 h-4 rounded-md bg-[#F14635] text-white text-[10px] font-extrabold flex items-center justify-center">
                      K
                    </span>
                    <span>Kaspi</span>
                  </span>
                )}
                {hasHalyk && (
                  <span
                    title="Принимаем оплату через Halyk Bank"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50/80 border border-emerald-200/70 text-[11px] font-semibold text-neutral-900"
                  >
                    <span className="w-4 h-4 rounded-md bg-[#00805F] text-white text-[10px] font-extrabold flex items-center justify-center">
                      H
                    </span>
                    <span>Halyk</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {business.services_description && (
            <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 rounded-xl p-3.5 whitespace-pre-line">
              {business.services_description}
            </p>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            {locationLabel && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {locationLabel}
              </span>
            )}
            {business.working_hours && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {business.working_hours}
              </span>
            )}
          </div>

          {(business.phone || business.whatsapp || business.telegram) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {business.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-900 text-xs font-semibold transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Позвонить
                </a>
              )}
              {business.whatsapp && (
                <a
                  href={`https://wa.me/${cleanPhoneForWa(business.whatsapp)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              )}
              {business.telegram && (
                <a
                  href={`https://t.me/${cleanTelegramHandle(business.telegram)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Telegram
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Catalog */}
      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-5">
        {products.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? "bg-neutral-950 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
              Каталог компании пока наполняется. Вы можете связаться по контактам выше
              или написать ИИ-помощнику.
            </div>
          ) : (
            filteredProducts.map((product) => {
              const qty = cart[product.id] || 0;
              return (
                <div
                  key={product.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-950">{product.name}</div>
                      {product.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                    </div>
                    <div className="font-bold text-neutral-950 shrink-0 text-base">
                      {formatKZT(product.price)}
                    </div>
                  </div>

                  {/* Кнопки под товаром / услугой */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    {qty === 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => addToCart(product.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-800 text-xs font-semibold transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          В корзину
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBuyNow(product.id)}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold transition"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Купить / Заказать
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => removeFromCart(product.id)}
                            className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-700 shadow-sm"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => addToCart(product.id)}
                            className="w-7 h-7 rounded-lg bg-neutral-950 text-white flex items-center justify-center shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCheckoutOpen(true)}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold transition"
                        >
                          Перейти в корзину
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Bottom Floating Cart & AI Chat */}
      <div className="fixed bottom-4 inset-x-0 px-4 z-30 pointer-events-none">
        <div className="max-w-2xl mx-auto flex items-center justify-end gap-3">
          {cartCount > 0 && (
            <button
              onClick={() => setCheckoutOpen(true)}
              className="pointer-events-auto flex-1 flex items-center justify-between px-5 py-3.5 rounded-2xl bg-neutral-950 text-white shadow-lg hover:bg-neutral-800 transition"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <ShoppingCart className="w-4 h-4" />
                Корзина ({cartCount})
              </span>
              <span className="font-bold text-sm">{formatKZT(cartTotal)}</span>
            </button>
          )}

          {aiEnabled && (
            <button
              onClick={() => setChatOpen(true)}
              className="pointer-events-auto flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition text-sm font-semibold"
            >
              <Bot className="w-5 h-5" />
              <span>Чат с ИИ</span>
            </button>
          )}
        </div>
      </div>

      {/* CART & CHECKOUT MODAL */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-neutral-950" />
                <h2 className="text-lg font-bold text-neutral-950">Корзина и оформление</h2>
              </div>
              <button
                onClick={() => setCheckoutOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {cartItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  Корзина пуста. Выберите товары или услуги на витрине.
                </div>
              ) : (
                <>
                  {/* Selected Items */}
                  <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Выбранные позиции
                    </div>
                    {cartItems.map((i) => (
                      <div
                        key={i.productId}
                        className="flex items-center justify-between gap-2 text-sm bg-white p-2.5 rounded-xl border border-slate-200/80"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-950 truncate">
                            {i.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatKZT(i.price)} × {i.quantity} ={" "}
                            <strong className="text-neutral-900">
                              {formatKZT(i.price * i.quantity)}
                            </strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => removeFromCart(i.productId)}
                            className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold">
                            {i.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => addToCart(i.productId)}
                            className="w-7 h-7 rounded-lg bg-neutral-950 text-white flex items-center justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFromCart(i.productId)}
                            className="p-1.5 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Итого</span>
                      <span className="text-lg font-bold text-neutral-950">
                        {formatKZT(cartTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <CreditCard className="w-3.5 h-3.5" />
                      Способ оплаты
                    </div>
                    <div className="space-y-2">
                      {paymentOptions.map((opt) => {
                        const selected = paymentMethod === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPaymentMethod(opt.id)}
                            className={`w-full text-left p-3 rounded-xl border-2 transition flex items-center justify-between gap-3 ${
                              selected
                                ? "border-neutral-950 bg-neutral-50/70"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {opt.badge === "kaspi" && (
                                <span className="w-7 h-7 rounded-lg bg-[#F14635] text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                                  K
                                </span>
                              )}
                              {opt.badge === "halyk" && (
                                <span className="w-7 h-7 rounded-lg bg-[#00805F] text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                                  H
                                </span>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-950">
                                  {opt.label}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {opt.hint}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                selected ? "border-neutral-950" : "border-slate-300"
                              }`}
                            >
                              {selected && (
                                <span className="w-2 h-2 rounded-full bg-neutral-950" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delivery / Receiving Method Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Truck className="w-3.5 h-3.5" />
                      Способ получения / Доставка
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {DELIVERY_OPTIONS.map((opt) => {
                        const selected = deliveryMethod === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setDeliveryMethod(opt.id)}
                            className={`w-full text-left p-3 rounded-xl border-2 transition flex items-center justify-between gap-3 ${
                              selected
                                ? "border-neutral-950 bg-neutral-50/70"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div>
                              <div className="text-sm font-semibold text-neutral-950">
                                {opt.label}
                              </div>
                              <div className="text-[11px] text-slate-500">{opt.hint}</div>
                            </div>
                            <span
                              className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                selected ? "border-neutral-950" : "border-slate-300"
                              }`}
                            >
                              {selected && (
                                <span className="w-2 h-2 rounded-full bg-neutral-950" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Client Contact Form */}
                  <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Ваши контакты
                    </div>
                    <input
                      type="text"
                      placeholder="Ваше имя"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Ваш телефон (WhatsApp / Kaspi)"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      required
                    />
                    <input
                      type="text"
                      placeholder={
                        deliveryMethod === "Доставка курьером"
                          ? "Укажите адрес доставки и подъезд"
                          : "Комментарий к заказу (время, пожелания)"
                      }
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />

                    {orderError && (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                        {orderError}
                      </div>
                    )}
                  </form>
                </>
              )}
            </div>

            {/* Modal Footer */}
            {cartItems.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-white shrink-0 space-y-2">
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={submittingOrder}
                  className="w-full py-3.5 rounded-xl bg-neutral-950 text-white font-semibold text-sm hover:bg-neutral-800 disabled:opacity-50 transition"
                >
                  {submittingOrder
                    ? "Оформляем..."
                    : paymentMethod === "Kaspi Pay"
                    ? `Оформить и перейти к Kaspi (${formatKZT(cartTotal)})`
                    : `Подтвердить заказ (${formatKZT(cartTotal)})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POST-ORDER PAYMENT & RECEIPT MODAL */}
      {orderResult && (
        <div className="fixed inset-0 bg-black/55 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-neutral-950">
                    Заказ {orderResult.orderCode} принят!
                  </h2>
                  <p className="text-xs text-slate-500">
                    Отправлен в «{business.name}»
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOrderResult(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Amount Box with Copy Button */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500">Сумма к оплате</div>
                  <div className="text-2xl font-extrabold text-neutral-950">
                    {formatKZT(orderResult.totalPrice)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(String(orderResult.totalPrice));
                    setCopiedAmount(true);
                    setTimeout(() => setCopiedAmount(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-neutral-800 hover:bg-slate-100 transition"
                >
                  {copiedAmount ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedAmount ? "Скопировано" : "Копировать"}
                </button>
              </div>
              <div className="text-xs text-slate-500 pt-1 border-t border-slate-200/70">
                Оплата: <strong>{orderResult.paymentMethod}</strong> • Получение:{" "}
                <strong>{orderResult.deliveryMethod}</strong>
              </div>
            </div>

            {/* Kaspi Pay Direct Action */}
            {orderResult.paymentMethod === "Kaspi Pay" && hasKaspi && (
              <div className="space-y-2.5">
                <a
                  href={kaspiLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#F14635] hover:bg-[#d93b2b] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-xs font-extrabold">
                    K
                  </span>
                  <span>Оплатить через Kaspi Pay</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                  Нажмите кнопку, введите сумму{" "}
                  <strong>{formatKZT(orderResult.totalPrice)}</strong> в приложении Kaspi.kz
                  и отправьте чек в WhatsApp компании для быстрого подтверждения.
                </p>
              </div>
            )}

            {/* WhatsApp Receipt / Confirmation Button */}
            {waNumber && (
              <a
                href={buildWhatsappReceiptUrl(orderResult)}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-sm flex items-center justify-center gap-2 transition"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>
                  {orderResult.paymentMethod === "Kaspi Pay"
                    ? "Отправить чек в WhatsApp"
                    : "Связаться по заказу в WhatsApp"}
                </span>
              </a>
            )}

            <button
              type="button"
              onClick={() => setOrderResult(null)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition"
            >
              Вернуться на витрину
            </button>
          </div>
        </div>
      )}

      {/* AI Chat Modal */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md h-[80vh] sm:h-[75vh] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <div>
                  <div className="font-semibold text-sm">TIYIN AI</div>
                  <div className="text-[11px] text-neutral-400">{business.name}</div>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 hover:bg-neutral-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {chatOrderBanner && (
              <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{chatOrderBanner}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-line ${
                      m.role === "user"
                        ? "bg-neutral-950 text-white rounded-br-sm"
                        : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="text-xs text-slate-400">TIYIN AI печатает ответ...</div>
              )}
            </div>

            <form
              onSubmit={handleSendChat}
              className="p-3 bg-white border-t border-slate-200 flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Напишите ваш вопрос..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="p-2.5 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
