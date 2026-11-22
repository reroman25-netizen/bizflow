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
  Instagram,
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Business, Product } from "@/lib/types";
import { formatKZT, cleanPhoneForWa, cleanTelegramHandle } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";
import { PwaInstallButton } from "@/components/PwaInstallButton";

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
    hint: "Укажите адрес доставки ниже",
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

function normalizeInstagramUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const cleanHandle = trimmed
    .replace(/^@/, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^www\.instagram\.com\//i, "")
    .replace(/\/+$/, "");
  return cleanHandle ? `https://instagram.com/${cleanHandle}` : "";
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

function getProductPhotos(p: Product): string[] {
  const list: string[] = [];
  if (p.image_url?.trim()) list.push(p.image_url.trim());
  if (Array.isArray(p.gallery_urls)) {
    for (const url of p.gallery_urls) {
      if (typeof url === "string" && url.trim() && !list.includes(url.trim())) {
        list.push(url.trim());
      }
    }
  }
  return list;
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
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [addedToast, setAddedToast] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("Оплата при получении / Уточнить");
  const [deliveryMethod, setDeliveryMethod] = useState("Самовывоз");
  const [deliveryAddress, setDeliveryAddress] = useState("");
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
      text: "Здравствуйте! Подсказать по товарам, услугам, ценам или помочь оформить заказ?",
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
      <div className="min-h-screen flex items-center justify-center text-slate-500 bg-[#F6F7F9]">
        Загрузка витрины...
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-[#F6F7F9]">
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
  const instagramUrl = normalizeInstagramUrl(business.instagram || "");

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
      hint: "Оплата через Halyk QR / карту",
      badge: "halyk",
    });
  }
  paymentOptions.push({
    id: "Оплата при получении / Уточнить",
    label: "Оплата при получении / Уточнить",
    hint: "Наличными или по согласованию с менеджером",
  });

  const uniqueCategories = Array.from(
    new Set(products.map((p) => (p.category || "").trim()).filter(Boolean))
  );
  const categories = uniqueCategories.length > 0 ? ["Все", ...uniqueCategories] : [];

  const filteredProducts =
    selectedCategory === "Все"
      ? products
      : products.filter((p) => (p.category || "").trim() === selectedCategory);

  const addToCart = (product: Product) => {
    setCart((prev) => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
    setAddedToast(`«${product.name}» добавлено в корзину`);
    setTimeout(() => setAddedToast(""), 1800);
  };

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

  const openProductModal = (p: Product) => {
    setActiveProduct(p);
    setActivePhotoIndex(0);
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
    if (deliveryMethod === "Доставка курьером" && !deliveryAddress.trim()) {
      setOrderError("Пожалуйста, укажите адрес доставки.");
      return;
    }

    setSubmittingOrder(true);
    setOrderError("");

    const fullComment = [
      deliveryMethod === "Доставка курьером" && deliveryAddress.trim()
        ? `Адрес доставки: ${deliveryAddress.trim()}`
        : "",
      comment.trim(),
    ]
      .filter(Boolean)
      .join(" | ");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          userId,
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          comment: fullComment,
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
          )} оформлен!`
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

  const hasSocialLinks = Boolean(
    instagramUrl || business.whatsapp || business.telegram || business.phone
  );

  const activePhotos = activeProduct ? getProductPhotos(activeProduct) : [];

  return (
    <div className="min-h-screen bg-[#F6F7F9] pb-24">
      {/* STICKY TOP BAR: Back (left) | TIYIN Space logo (center) | Cart button (right) */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <Link
            href="/"
            aria-label="Поиск компаний"
            className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-neutral-700 transition shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <Link href="/" className="hover:opacity-90 transition">
            <BrandLogo size="sm" />
          </Link>

          <button
            type="button"
            onClick={() => {
              setOrderError("");
              setCheckoutOpen(true);
            }}
            aria-label="Открыть корзину"
            className={`relative h-10 px-3 rounded-xl flex items-center gap-1.5 font-semibold text-xs transition shrink-0 ${
              cartCount > 0
                ? "bg-neutral-950 text-white shadow-sm"
                : "bg-slate-100 text-neutral-700 hover:bg-slate-200"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && <span>{cartCount}</span>}
          </button>
        </div>
      </div>

      {/* Quick Toast when item added */}
      {addedToast && (
        <div className="fixed top-16 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="bg-neutral-950 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg">
            {addedToast}
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="max-w-2xl mx-auto">
        {/* RED ZONE: COVER BANNER WITH BUSINESS NAME ON LEFT & DARK GRADIENT */}
        <div className="px-3 sm:px-4 pt-3">
          <div
            className="relative h-44 sm:h-52 rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 flex items-end p-5"
            style={
              business.cover_url
                ? {
                    backgroundImage: `url(${business.cover_url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {
                    background:
                      "radial-gradient(circle at 82% 18%, #2e3b55 0%, #151923 55%, #090b10 100%)",
                  }
            }
          >
            {/* Subtle decorative glow for default cover */}
            {!business.cover_url && (
              <div
                className="absolute -right-12 -top-12 w-56 h-56 rounded-full opacity-30 blur-3xl pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                }}
              />
            )}

            {/* Contrast Scrim so text is ALWAYS crisp & readable */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

            <div className="relative z-10 text-left max-w-[92%]">
              {business.category && (
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white/90 text-[11px] font-medium mb-2">
                  {business.category}
                </span>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight drop-shadow-sm">
                {business.name}
              </h1>
              {business.tagline && (
                <p className="text-xs sm:text-sm text-white/80 mt-1 line-clamp-2">
                  {business.tagline}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* GREEN ZONE: SOCIAL LINKS & CONTACTS (ONLY IF CONFIGURED BY BUSINESS) */}
        <div className="px-3 sm:px-4 pt-3.5 space-y-2.5">
          {(hasSocialLinks || business.pwa_enabled !== false) && (
            <div className="flex flex-wrap gap-2">
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 hover:from-pink-500/15 hover:to-purple-500/15 border border-pink-200/80 text-pink-700 text-xs font-semibold transition"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  Instagram
                </a>
              )}
              {business.whatsapp && (
                <a
                  href={`https://wa.me/${cleanPhoneForWa(business.whatsapp)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 text-emerald-700 text-xs font-semibold transition"
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200/70 text-sky-700 text-xs font-semibold transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Telegram
                </a>
              )}
              {business.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-neutral-800 text-xs font-semibold transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Позвонить
                </a>
              )}
              <PwaInstallButton
                businessName={business.name}
                logoUrl={business.logo_url}
                pwaEnabled={business.pwa_enabled !== false}
              />
            </div>
          )}

          {/* Address & Working Hours */}
          {(locationLabel || business.working_hours) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 px-1">
              {locationLabel && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {locationLabel}
                </span>
              )}
              {business.working_hours && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {business.working_hours}
                </span>
              )}
            </div>
          )}
        </div>

        {/* BLACK ZONE: COMPACT CATEGORY BUTTONS (TEXT ONLY, NO ICONS) */}
        {categories.length > 0 && (
          <div className="px-3 sm:px-4 pt-4">
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? "bg-neutral-950 text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* INSTAGRAM-STYLE 2-COLUMN PRODUCT GRID */}
        <main className="px-3 sm:px-4 pt-4">
          {filteredProducts.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-sm text-slate-500">
              Каталог компании пока наполняется. Вы можете связаться по контактам выше
              или написать в чат компании.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((product) => {
                const qty = cart[product.id] || 0;
                const photos = getProductPhotos(product);
                const mainPhoto = photos[0];

                return (
                  <div
                    key={product.id}
                    onClick={() => openProductModal(product)}
                    className="group bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col cursor-pointer"
                  >
                    {/* Product Square Image */}
                    <div className="relative aspect-square bg-slate-100 overflow-hidden">
                      {mainPhoto ? (
                        <img
                          src={mainPhoto}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200/70 text-slate-400">
                          <Package className="w-8 h-8 opacity-50" />
                        </div>
                      )}

                      {/* Photo count indicator if gallery has > 1 photo */}
                      {photos.length > 1 && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-white text-[10px] font-semibold">
                          1/{photos.length}
                        </span>
                      )}
                    </div>

                    {/* Card Content: Title + Short Description + Bottom-Right Colorful Cart Square */}
                    <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <div className="font-semibold text-xs sm:text-sm text-neutral-950 line-clamp-2 leading-snug">
                          {product.name}
                        </div>
                        {product.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                            {product.description}
                          </p>
                        )}
                      </div>

                      {/* Price (left) + Small Colorful Square Cart+ Button (bottom-right) */}
                      <div className="flex items-end justify-between gap-1.5 pt-1">
                        <div className="font-extrabold text-sm text-neutral-950 leading-none">
                          {formatKZT(product.price)}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          aria-label={
                            product.item_type === "service"
                              ? "Заказать услугу"
                              : "Добавить в корзину"
                          }
                          className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition active:scale-95 ${
                            qty > 0
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        >
                          <ShoppingCart className="w-4 h-4" />
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-md bg-neutral-950 text-white text-[9px] font-extrabold flex items-center justify-center border border-white">
                            {qty > 0 ? qty : "+"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* FLOATING CHAT BUTTON: "Чат с [Название бизнеса]" */}
      {aiEnabled && (
        <div className="fixed bottom-4 right-4 z-30">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition text-xs sm:text-sm font-semibold max-w-[260px]"
          >
            <Bot className="w-4 h-4 shrink-0" />
            <span className="truncate">Чат с {business.name}</span>
          </button>
        </div>
      )}

      {/* PRODUCT DETAIL POPUP MODAL (MEDIUM-SIZED, WITH GALLERY & FULL DESCRIPTION) */}
      {activeProduct && (
        <div
          onClick={() => setActiveProduct(null)}
          className="fixed inset-0 bg-black/55 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md max-h-[88vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Photo / Gallery Carousel */}
            <div className="relative bg-slate-100 aspect-[4/3] shrink-0 overflow-hidden">
              {activePhotos.length > 0 ? (
                <img
                  src={activePhotos[activePhotoIndex] || activePhotos[0]}
                  alt={activeProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Package className="w-12 h-12" />
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveProduct(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-sm transition"
              >
                <X className="w-5 h-5" />
              </button>

              {activePhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIndex((prev) =>
                        prev === 0 ? activePhotos.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIndex((prev) =>
                        prev === activePhotos.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5">
                    {activePhotos.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === activePhotoIndex
                            ? "w-5 bg-white"
                            : "w-1.5 bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails strip if multiple photos */}
            {activePhotos.length > 1 && (
              <div className="px-4 pt-3 flex gap-2 overflow-x-auto shrink-0">
                {activePhotos.map((url, idx) => (
                  <button
                    key={url + idx}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                      idx === activePhotoIndex
                        ? "border-neutral-950"
                        : "border-transparent opacity-60"
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Full Title & Description */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
              <div className="flex items-center gap-2">
                {activeProduct.category && (
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
                    {activeProduct.category}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-medium">
                  {activeProduct.item_type === "service" ? "Услуга" : "Товар"}
                </span>
              </div>

              <h2 className="text-xl font-bold text-neutral-950 leading-snug">
                {activeProduct.name}
              </h2>

              <div className="text-xl font-extrabold text-neutral-950">
                {formatKZT(activeProduct.price)}
              </div>

              {activeProduct.description ? (
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line pt-1">
                  {activeProduct.description}
                </p>
              ) : (
                <p className="text-xs text-slate-400 pt-1">
                  Подробное описание не указано. Вы можете уточнить детали в чате компании.
                </p>
              )}
            </div>

            {/* Modal Bottom Action */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex items-center gap-2.5">
              {(cart[activeProduct.id] || 0) > 0 ? (
                <>
                  <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => removeFromCart(activeProduct.id)}
                      className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-slate-700 shadow-sm"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold">
                      {cart[activeProduct.id]}
                    </span>
                    <button
                      type="button"
                      onClick={() => addToCart(activeProduct)}
                      className="w-9 h-9 rounded-lg bg-neutral-950 text-white flex items-center justify-center shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveProduct(null);
                      setCheckoutOpen(true);
                    }}
                    className="flex-1 py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-semibold transition"
                  >
                    Перейти в корзину
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => addToCart(activeProduct)}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>
                    {activeProduct.item_type === "service"
                      ? `Заказать — ${formatKZT(activeProduct.price)}`
                      : `В корзину — ${formatKZT(activeProduct.price)}`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CART & CHECKOUT MODAL */}
      {checkoutOpen && (
        <div
          onClick={() => setCheckoutOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
          >
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

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {cartItems.length === 0 ? (
                <div className="text-center py-10 text-sm text-slate-500">
                  Корзина пока пуста. Нажмите на значок корзины на карточке товара, чтобы
                  добавить его.
                </div>
              ) : (
                <>
                  {/* Selected Items */}
                  <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Выбранные позиции
                    </div>
                    {cartItems.map((i) => {
                      const prodObj = products.find((p) => p.id === i.productId);
                      return (
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
                              onClick={() => prodObj && addToCart(prodObj)}
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
                      );
                    })}

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
                                <div className="text-[11px] text-slate-500">{opt.hint}</div>
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

                  {/* Delivery Method Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Truck className="w-3.5 h-3.5" />
                      Получение / Доставка
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

                  {/* Contact & Delivery Address Form */}
                  <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Данные для заказа
                    </div>

                    {deliveryMethod === "Доставка курьером" && (
                      <input
                        type="text"
                        placeholder="Адрес доставки (улица, дом, кв / подъезд)"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 border-neutral-900 text-sm focus:outline-none"
                        required
                      />
                    )}

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
                      placeholder="Комментарий к заказу (время, пожелания)"
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

            {cartItems.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-white shrink-0">
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
                  <p className="text-xs text-slate-500">Отправлен в «{business.name}»</p>
                </div>
              </div>
              <button
                onClick={() => setOrderResult(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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
                  и отправьте чек в WhatsApp компании.
                </p>
              </div>
            )}

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

      {/* CHAT MODAL */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md h-[80vh] sm:h-[75vh] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Bot className="w-5 h-5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{business.name}</div>
                  <div className="text-[11px] text-emerald-400">Онлайн • TIYIN AI</div>
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
                <div className="text-xs text-slate-400">Печатает ответ...</div>
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
