"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Clock,
  ShoppingCart,
  Plus,
  Minus,
  Bot,
  Send,
  X,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { loadPlatformData, savePlatformData, formatKZT } from "@/lib/storage";
import { PlatformData, Order } from "@/lib/types";

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

export default function BusinessStorefrontPage() {
  const params = useParams();
  const slug = String(params?.slug || "");

  const [data, setData] = useState<PlatformData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Checkout form
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("+7 ");
  const [address, setAddress] = useState("");

  // AI Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: "Здравствуйте! Я ИИ-помощник. Подсказать по меню, ценам или доставке?",
    },
  ]);

  useEffect(() => {
    setData(loadPlatformData());
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Загрузка витрины...
      </div>
    );
  }

  const availableProducts = data.products.filter((p) => p.isAvailable);
  const categories = [
    "Все",
    ...Array.from(new Set(availableProducts.map((p) => p.category))),
  ];
  const filteredProducts =
    selectedCategory === "Все"
      ? availableProducts
      : availableProducts.filter((p) => p.category === selectedCategory);

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
      const prod = data.products.find((p) => p.id === id);
      if (!prod) return null;
      return { productId: prod.id, name: prod.name, price: prod.price, quantity: qty };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim() || cartItems.length === 0) return;

    const nowLabel =
      "Сегодня, " +
      new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    const newOrder: Order = {
      id: "ORD-" + Math.floor(1050 + Math.random() * 8900),
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      address: address.trim() || "Самовывоз",
      items: cartItems,
      totalPrice: cartTotal,
      status: "new",
      paymentMethod: "Kaspi Pay",
      createdAt: nowLabel,
    };

    const existingClientIndex = data.clients.findIndex(
      (c) => c.phone.replace(/\D/g, "") === clientPhone.replace(/\D/g, "")
    );

    const updatedClients = [...data.clients];
    if (existingClientIndex >= 0) {
      const existing = updatedClients[existingClientIndex];
      updatedClients[existingClientIndex] = {
        ...existing,
        ordersCount: existing.ordersCount + 1,
        totalSpent: existing.totalSpent + cartTotal,
        lastOrderAt: nowLabel,
      };
    } else {
      updatedClients.unshift({
        id: "c-" + Date.now(),
        name: clientName.trim(),
        phone: clientPhone.trim(),
        ordersCount: 1,
        totalSpent: cartTotal,
        lastOrderAt: nowLabel,
      });
    }

    const nextData: PlatformData = {
      ...data,
      orders: [newOrder, ...data.orders],
      clients: updatedClients,
    };

    setData(nextData);
    savePlatformData(nextData);
    setCart({});
    setCheckoutOpen(false);
    setOrderSuccess(newOrder.id);
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
          message: text,
          businessName: data.business.name,
          aiPrompt: data.business.aiPrompt,
          products: data.products,
        }),
      });
      const json = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: json.reply || "Готов помочь с заказом!" },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Не удалось связаться с сервером. Попробуйте еще раз." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Top Business Banner (Isolated Storefront) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Поиск
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              В кабинет ИП →
            </Link>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{data.business.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{data.business.tagline}</p>
          <div className="flex flex-wrap gap-3 mt-2.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {data.business.address}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {data.business.workingHours}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-5">
        {slug !== data.business.slug && (
          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl">
            Показана демо-витрина «{data.business.name}».
          </div>
        )}

        {orderSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-emerald-900">
                Заказ {orderSuccess} оплачен и передан в работу!
              </div>
              <p className="text-emerald-700 text-xs mt-0.5">
                Проверьте раздел «Заказы» и «База клиентов» в Кабинете ИП — данные уже там.
              </p>
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product List */}
        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const qty = cart[product.id] || 0;
            return (
              <div
                key={product.id}
                className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{product.name}</div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="font-bold text-slate-900 mt-2">
                    {formatKZT(product.price)}
                  </div>
                </div>

                {qty === 0 ? (
                  <button
                    onClick={() => addToCart(product.id)}
                    className="shrink-0 inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить
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
                      className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Bottom Bar: Cart & AI Chat */}
      <div className="fixed bottom-4 inset-x-0 px-4 z-30 pointer-events-none">
        <div className="max-w-2xl mx-auto flex items-center justify-end gap-3">
          {cartCount > 0 && (
            <button
              onClick={() => setCheckoutOpen(true)}
              className="pointer-events-auto flex-1 flex items-center justify-between px-5 py-3.5 rounded-2xl bg-slate-900 text-white shadow-lg hover:bg-slate-800 transition"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <ShoppingCart className="w-4 h-4" />
                Корзина ({cartCount})
              </span>
              <span className="font-bold text-sm">{formatKZT(cartTotal)}</span>
            </button>
          )}

          {data.business.aiEnabled && (
            <button
              onClick={() => setChatOpen(true)}
              className="pointer-events-auto flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              <Bot className="w-5 h-5" />
              <span className="hidden sm:inline">Чат с ИИ</span>
            </button>
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Оформление заказа</h2>
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
              <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold text-sm text-slate-900">
                <span>Итого к оплате</span>
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
                placeholder="Номер телефона (Kaspi)"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Адрес доставки (или Самовывоз)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition"
              >
                Оплатить через Kaspi Pay • {formatKZT(cartTotal)}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* AI Chat Modal */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md h-[75vh] rounded-2xl flex flex-col overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <div>
                  <div className="font-semibold text-sm">ИИ-помощник</div>
                  <div className="text-[11px] text-blue-100">{data.business.name}</div>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 hover:bg-blue-700 rounded-lg"
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
                        ? "bg-blue-600 text-white rounded-br-sm"
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
                placeholder="Спросите про меню или доставку..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
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
