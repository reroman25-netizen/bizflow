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
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Business, Product } from "@/lib/types";
import { formatKZT, cleanPhoneForWa, cleanTelegramHandle } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
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
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("+7 ");
  const [comment, setComment] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: "Здравствуйте! Я ИИ-помощник компании. Подсказать по услугам, ценам или наличию?",
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
          items: cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setCart({});
        setCheckoutOpen(false);
        setOrderSuccess(json.orderCode || "Принят");
      }
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
          message: text,
        }),
      });
      const json = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: json.reply || "Готов помочь!" },
      ]);
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

          <div className="pt-1">
            <h1 className="text-2xl font-bold text-neutral-950">{business.name}</h1>
            {business.tagline && (
              <p className="text-sm text-slate-600 mt-1">{business.tagline}</p>
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
        {orderSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-emerald-900">
                Заявка {orderSuccess} отправлена в «{business.name}»!
              </div>
              <p className="text-emerald-700 text-xs mt-0.5">
                Менеджер свяжется с вами для подтверждения оплаты и доставки.
              </p>
            </div>
          </div>
        )}

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
                  className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-neutral-950">{product.name}</div>
                    {product.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <div className="font-bold text-neutral-950 mt-2">
                      {formatKZT(product.price)}
                    </div>
                  </div>

                  {qty === 0 ? (
                    <button
                      onClick={() => addToCart(product.id)}
                      className="shrink-0 inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-neutral-100 text-neutral-900 text-xs font-semibold hover:bg-neutral-200 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Выбрать
                    </button>
                  ) : (
                    <div className="shrink-0 flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-700 shadow-sm"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                      <button
                        onClick={() => addToCart(product.id)}
                        className="w-7 h-7 rounded-lg bg-neutral-950 text-white flex items-center justify-center shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
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
                Заказ ({cartCount})
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

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-950">Оформление заявки</h2>
              <button
                onClick={() => setCheckoutOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs">
              {cartItems.map((i) => (
                <div key={i.productId} className="flex justify-between">
                  <span>
                    {i.name} ×{i.quantity}
                  </span>
                  <span className="font-medium">{formatKZT(i.price * i.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold text-sm text-neutral-950">
                <span>Итого</span>
                <span>{formatKZT(cartTotal)}</span>
              </div>
            </div>

            <form onSubmit={handleCheckout} className="space-y-3">
              <input
                type="text"
                placeholder="Ваше имя"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                required
              />
              <input
                type="tel"
                placeholder="Ваш телефон (WhatsApp / Kaspi)"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Адрес или комментарий к заказу"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <button
                type="submit"
                disabled={submittingOrder}
                className="w-full py-3 rounded-xl bg-neutral-950 text-white font-semibold text-sm hover:bg-neutral-800 disabled:opacity-50 transition"
              >
                {submittingOrder ? "Отправка..." : "Отправить заказ"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* AI Chat Modal */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md h-[75vh] rounded-2xl flex flex-col overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <div>
                  <div className="font-semibold text-sm">ИИ-агент</div>
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
                <div className="text-xs text-slate-400">ИИ печатает ответ...</div>
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
