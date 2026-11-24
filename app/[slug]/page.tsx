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
  Menu,
  Calendar,
  Sparkles,
  Tag,
  Upload,
  FileText,
  ShieldCheck,
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
  orderId: string;
  orderCode: string;
  totalPrice: number;
  paymentMethod: string;
  deliveryMethod: string;
  isBooking?: boolean;
  bookingDateTime?: string;
  serviceName?: string;
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

const TIME_SLOTS = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

function getLocalIsoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoDateRu(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function isValidKzPhone(raw: string): boolean {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length === 11 && (digits.startsWith("77") || digits.startsWith("87"));
}

function loadExternalScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Browser only"));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Не удалось загрузить платёжный виджет банка."));
    document.head.appendChild(script);
  });
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});

  const [bookingService, setBookingService] = useState<Product | null>(null);
  const [bookingDate, setBookingDate] = useState(() => getLocalIsoDate(0));
  const [bookingTime, setBookingTime] = useState("12:00");
  const [bookingError, setBookingError] = useState("");
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptUploadedUrl, setReceiptUploadedUrl] = useState("");
  const [paymentReturnModal, setPaymentReturnModal] = useState<{
    status: "success" | "failed";
    orderCode: string;
    provider: string;
  } | null>(null);
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
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const pStatus = sp.get("payment");
      const pOrder = sp.get("order") || "";
      const pProvider = sp.get("provider") || "";
      if (pStatus === "success" || pStatus === "failed") {
        setPaymentReturnModal({
          status: pStatus,
          orderCode: pOrder,
          provider:
            pProvider === "halyk"
              ? "Halyk ePay"
              : pProvider === "freedom"
              ? "Freedom Pay"
              : "Онлайн-оплата",
        });
        // Очищаем параметры из адресной строки
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }
    }

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

      if (typedBiz.halyk_api_enabled) {
        setPaymentMethod("Halyk ePay");
      } else if (typedBiz.freedom_api_enabled) {
        setPaymentMethod("Freedom Pay");
      } else if (typedBiz.kaspi_pay_link?.trim()) {
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

  const isServiceMode = business.storefront_template === "services";
  const kaspiLink = normalizeUrl(business.kaspi_pay_link || "");
  const hasKaspi = Boolean(kaspiLink);
  const hasHalykApi = Boolean(business.halyk_api_enabled);
  const hasFreedomApi = Boolean(business.freedom_api_enabled);
  const hasHalyk = Boolean(business.halyk_enabled);
  const instagramUrl = normalizeInstagramUrl(business.instagram || "");

  const paymentOptions: {
    id: string;
    label: string;
    hint: string;
    badge?: "kaspi" | "halyk" | "freedom";
  }[] = [];

  if (hasHalykApi) {
    paymentOptions.push({
      id: "Halyk ePay",
      label: "Halyk ePay (Карта / Apple Pay / Google Pay)",
      hint: "Мгновенная онлайн-оплата без отправки чека",
      badge: "halyk",
    });
  }
  if (hasFreedomApi) {
    paymentOptions.push({
      id: "Freedom Pay",
      label: "Freedom Pay (Карта / Apple Pay / Google Pay)",
      hint: "Мгновенная онлайн-оплата без отправки чека",
      badge: "freedom",
    });
  }
  if (hasKaspi) {
    paymentOptions.push({
      id: "Kaspi Pay",
      label: "Kaspi Pay",
      hint: "Оплата по ссылке Kaspi.kz + загрузка чека на сайте",
      badge: "kaspi",
    });
  }
  if (hasHalyk && !hasHalykApi) {
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

  const categoryCounts: Record<string, number> = {};
  for (const p of products) {
    const cat = (p.category || "").trim();
    if (cat) {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  }
  const uniqueCategories = Object.keys(categoryCounts);
  const categories = uniqueCategories.length > 0 ? ["Все", ...uniqueCategories] : [];

  const openBookingModal = (service: Product) => {
    setBookingService(service);
    setBookingDate(getLocalIsoDate(0));
    setBookingTime("12:00");
    setBookingError("");
  };

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

  const startOnlinePayment = async (
    provider: "halyk" | "freedom",
    orderId: string,
    orderCode: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const endpoint =
        provider === "halyk"
          ? "/api/payments/halyk/init"
          : "/api/payments/freedom/init";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, orderCode }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        return {
          ok: false,
          error: json.error || "Не удалось открыть окно оплаты банка.",
        };
      }

      if (provider === "freedom" && json.redirectUrl) {
        window.location.href = json.redirectUrl;
        return { ok: true };
      }

      if (provider === "halyk" && json.scriptUrl && json.paymentObject) {
        await loadExternalScript(json.scriptUrl);
        const win = window as unknown as {
          halyk?: { pay?: (obj: unknown) => void };
        };
        if (win.halyk?.pay) {
          win.halyk.pay(json.paymentObject);
          return { ok: true };
        }
        return {
          ok: false,
          error: "Виджет Halyk ePay не загрузился. Попробуйте обновить страницу.",
        };
      }

      return { ok: false, error: "Некорректный ответ платёжного шлюза." };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Ошибка соединения с платёжным шлюзом.",
      };
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim() || cartItems.length === 0) return;
    if (paymentMethod === "Kaspi Pay" && !isValidKzPhone(clientPhone)) {
      setOrderError(
        "Для оплаты через Kaspi Pay введите корректный номер Казахстана (+7 7XX XXX XX XX)."
      );
      return;
    }
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
        if (
          json.requiresOnlinePayment &&
          (json.paymentProvider === "halyk" || json.paymentProvider === "freedom")
        ) {
          const payInit = await startOnlinePayment(
            json.paymentProvider,
            json.orderId || "",
            json.orderCode || ""
          );
          if (!payInit.ok) {
            setOrderError(payInit.error || "Ошибка запуска онлайн-оплаты.");
            return;
          }
          setCart({});
          setCheckoutOpen(false);
          return;
        }
        setCart({});
        setCheckoutOpen(false);
        setReceiptUploadedUrl("");
        setReceiptError("");
        setOrderResult({
          orderId: json.orderId || "",
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

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingService || !clientName.trim() || !clientPhone.trim()) return;
    if (paymentMethod === "Kaspi Pay" && !isValidKzPhone(clientPhone)) {
      setBookingError(
        "Для оплаты через Kaspi Pay введите корректный номер Казахстана (+7 7XX XXX XX XX)."
      );
      return;
    }
    if (!bookingDate || !bookingTime.trim()) {
      setBookingError("Выберите удобную дату и время записи.");
      return;
    }

    setSubmittingBooking(true);
    setBookingError("");

    const formattedDateTime = `${formatIsoDateRu(bookingDate)} в ${bookingTime.trim()}`;
    const fullComment = [
      `Запись на ${formattedDateTime}`,
      bookingService.duration_label ? `Длительность: ${bookingService.duration_label}` : "",
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
          deliveryMethod: "Запись на услугу",
          source: "web",
          items: [{ productId: bookingService.id, quantity: 1 }],
        }),
      });
      const json = await res.json();
      if (res.ok) {
        if (
          json.requiresOnlinePayment &&
          (json.paymentProvider === "halyk" || json.paymentProvider === "freedom")
        ) {
          const payInit = await startOnlinePayment(
            json.paymentProvider,
            json.orderId || "",
            json.orderCode || ""
          );
          if (!payInit.ok) {
            setBookingError(payInit.error || "Ошибка запуска онлайн-оплаты.");
            return;
          }
          setBookingService(null);
          setComment("");
          return;
        }
        const bookedTitle = bookingService.name;
        const bookedPrice = bookingService.price;
        setBookingService(null);
        setComment("");
        setReceiptUploadedUrl("");
        setReceiptError("");
        setOrderResult({
          orderId: json.orderId || "",
          orderCode: json.orderCode || "ORD",
          totalPrice: Number(json.totalPrice ?? bookedPrice),
          paymentMethod,
          deliveryMethod: "Запись на услугу",
          isBooking: true,
          bookingDateTime: formattedDateTime,
          serviceName: bookedTitle,
        });
      } else {
        setBookingError(json.error || "Не удалось отправить запись. Попробуйте еще раз.");
      }
    } catch {
      setBookingError("Ошибка сети. Проверьте интернет и попробуйте снова.");
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orderResult || !business) return;
    setReceiptError("");
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("orderId", orderResult.orderId);
      fd.append("orderCode", orderResult.orderCode);
      fd.append("businessId", business.id);

      const res = await fetch("/api/orders/receipt", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setReceiptError(json.error || "Не удалось загрузить чек. Попробуйте снова.");
      } else {
        setReceiptUploadedUrl(json.receiptUrl || "uploaded");
      }
    } catch {
      setReceiptError("Ошибка сети при загрузке чека.");
    } finally {
      setUploadingReceipt(false);
      e.target.value = "";
    }
  };

  const kaspiPhoneInvalid =
    paymentMethod === "Kaspi Pay" && !isValidKzPhone(clientPhone);

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
      {/* CLEAN STICKY TOP BAR */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <Link
            href="/"
            aria-label="Поиск компаний"
            className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-neutral-700 transition shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2 min-w-0 hover:opacity-80 transition"
          >
            <div className="w-7 h-7 rounded-lg bg-neutral-950 text-white text-[10px] font-extrabold overflow-hidden flex items-center justify-center shrink-0">
              {business.logo_url ? (
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                (business.pwa_short_name || business.name || "TS")
                  .trim()
                  .slice(0, 2)
                  .toUpperCase()
              )}
            </div>
            <span className="font-bold text-sm text-neutral-950 truncate">
              {business.pwa_short_name || business.name}
            </span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {(!isServiceMode || cartCount > 0) && (
              <button
                type="button"
                onClick={() => {
                  setOrderError("");
                  setCheckoutOpen(true);
                }}
                aria-label="Открыть корзину"
                className={`relative h-10 px-3 rounded-xl flex items-center gap-1.5 font-semibold text-xs transition ${
                  cartCount > 0
                    ? "bg-neutral-950 text-white shadow-sm"
                    : "bg-slate-100 text-neutral-700 hover:bg-slate-200"
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && <span>{cartCount}</span>}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Открыть меню витрины"
              className="h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-900 font-semibold text-xs inline-flex items-center gap-1.5 transition"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline">Меню</span>
            </button>
          </div>
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
        {/* COMPACT HERO BANNER: LOGO + NAME + CATEGORY + "О нас" */}
        <div className="px-3 sm:px-4 pt-3">
          <div
            className="relative h-32 sm:h-40 rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 flex items-end p-4 sm:p-5"
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
            {!business.cover_url && (
              <div
                className="absolute -right-12 -top-12 w-52 h-52 rounded-full opacity-30 blur-3xl pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                }}
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

            <div className="relative z-10 w-full flex items-end justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 overflow-hidden flex items-center justify-center text-white font-extrabold text-base shrink-0 shadow-sm">
                  {business.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt={business.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (business.pwa_short_name || business.name || "TS")
                      .trim()
                      .slice(0, 2)
                      .toUpperCase()
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {business.category && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white/90 text-[10px] font-medium">
                        {business.category}
                      </span>
                    )}
                    {business.city && (
                      <span className="text-[11px] text-white/75">{business.city}</span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight truncate mt-0.5 drop-shadow-sm">
                    {business.name}
                  </h1>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white text-xs font-semibold shrink-0 transition"
              >
                О нас
              </button>
            </div>
          </div>
        </div>

        {/* CLEAN HORIZONTAL CATEGORIES WITH COUNTS */}
        {categories.length > 0 && (
          <div className="px-3 sm:px-4 pt-3.5">
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => {
                const count = cat === "Все" ? products.length : categoryCounts[cat] || 0;
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition ${
                      active
                        ? "bg-neutral-950 text-white shadow-sm"
                        : "bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MAIN CATALOG: SERVICES PRICE LIST OR SHOP GRID */}
        <main className="px-3 sm:px-4 pt-4">
          {filteredProducts.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-sm text-slate-500 space-y-3">
              <p>
                {isServiceMode
                  ? "Список услуг пока наполняется."
                  : "Каталог компании пока наполняется."}
              </p>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="px-4 py-2 rounded-xl bg-neutral-950 text-white text-xs font-semibold"
              >
                Открыть контакты компании
              </button>
            </div>
          ) : isServiceMode ? (
            <div className="space-y-2.5">
              {filteredProducts.map((service) => {
                const photos = getProductPhotos(service);
                const mainPhoto = photos[0];
                return (
                  <div
                    key={service.id}
                    onClick={() => openProductModal(service)}
                    className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-sm hover:shadow-md transition flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {mainPhoto && (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/70">
                          <img
                            src={mainPhoto}
                            alt={service.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm sm:text-base text-neutral-950 leading-snug">
                          {service.name}
                        </div>
                        {service.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                            {service.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="font-extrabold text-sm sm:text-base text-neutral-950">
                            {formatKZT(service.price)}
                          </span>
                          {service.duration_label && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-medium">
                              <Clock className="w-3 h-3" />
                              {service.duration_label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openBookingModal(service);
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold shrink-0 transition active:scale-95 shadow-sm"
                    >
                      Записаться
                    </button>
                  </div>
                );
              })}
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

                      {photos.length > 1 && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-white text-[10px] font-semibold">
                          1/{photos.length}
                        </span>
                      )}
                    </div>

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

      {/* RIGHT SLIDE-OUT MENU DRAWER */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50 flex justify-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[88%] max-w-sm bg-white h-full shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-neutral-950 text-white font-extrabold text-xs overflow-hidden flex items-center justify-center shrink-0">
                  {business.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt={business.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (business.pwa_short_name || business.name || "TS")
                      .trim()
                      .slice(0, 2)
                      .toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-neutral-950 truncate">
                    {business.name}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {[business.category, business.city].filter(Boolean).join(" • ")}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {(business.tagline || business.services_description) && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    О компании
                  </div>
                  {business.tagline && (
                    <div className="text-sm font-semibold text-neutral-900">
                      {business.tagline}
                    </div>
                  )}
                  {business.services_description && (
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                      {business.services_description}
                    </p>
                  )}
                </div>
              )}

              {categories.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <Tag className="w-3.5 h-3.5" />
                    <span>{isServiceMode ? "Разделы услуг" : "Категории каталога"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => {
                      const count =
                        cat === "Все" ? products.length : categoryCounts[cat] || 0;
                      const active = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat);
                            setMenuOpen(false);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                            active
                              ? "bg-neutral-950 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(locationLabel || business.working_hours) && (
                <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2.5 border border-slate-200/70">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Адрес и график
                  </div>
                  {locationLabel && (
                    <div className="flex items-start gap-2 text-xs text-neutral-800">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>{locationLabel}</span>
                    </div>
                  )}
                  {business.working_hours && (
                    <div className="flex items-start gap-2 text-xs text-neutral-800">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>{business.working_hours}</span>
                    </div>
                  )}
                  {locationLabel && (
                    <a
                      href={`https://2gis.kz/search/${encodeURIComponent(locationLabel)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Открыть в 2GIS</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  )}
                </div>
              )}

              {hasSocialLinks && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Связаться с нами
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {business.whatsapp && (
                      <a
                        href={`https://wa.me/${cleanPhoneForWa(business.whatsapp)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 text-emerald-700 text-xs font-semibold transition"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </a>
                    )}
                    {instagramUrl && (
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-pink-50 hover:bg-pink-100 border border-pink-200/70 text-pink-700 text-xs font-semibold transition"
                      >
                        <Instagram className="w-4 h-4" />
                        Instagram
                      </a>
                    )}
                    {business.telegram && (
                      <a
                        href={`https://t.me/${cleanTelegramHandle(business.telegram)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200/70 text-sky-700 text-xs font-semibold transition"
                      >
                        <Send className="w-4 h-4" />
                        Telegram
                      </a>
                    )}
                    {business.phone && (
                      <a
                        href={`tel:${business.phone}`}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-900 text-xs font-semibold transition"
                      >
                        <Phone className="w-4 h-4" />
                        Позвонить
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-2xl p-3.5 space-y-3 border border-slate-200/70">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Способы оплаты</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {hasKaspi && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#F14635]/10 text-[#F14635] text-xs font-semibold">
                        Kaspi Pay
                      </span>
                    )}
                    {(hasHalykApi || hasHalyk) && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#00805F]/10 text-[#00805F] text-xs font-semibold">
                        {hasHalykApi ? "Halyk ePay" : "Halyk Bank"}
                      </span>
                    )}
                    {hasFreedomApi && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#00B140]/10 text-[#008f33] text-xs font-semibold">
                        Freedom Pay
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium">
                      {isServiceMode ? "На месте" : "При получении"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200/70">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {isServiceMode ? (
                      <Calendar className="w-3.5 h-3.5" />
                    ) : (
                      <Truck className="w-3.5 h-3.5" />
                    )}
                    <span>{isServiceMode ? "Формат записи" : "Доставка и получение"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {isServiceMode ? (
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium">
                        Онлайн-запись на удобное время
                      </span>
                    ) : (
                      <>
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium">
                          Самовывоз
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium">
                          Доставка курьером
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {business.pwa_enabled !== false && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Приложение на телефон
                  </div>
                  <PwaInstallButton
                    businessName={business.pwa_short_name || business.name}
                    logoUrl={business.logo_url}
                    pwaEnabled={true}
                  />
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
              <Link href="/" className="hover:opacity-80 transition">
                <BrandLogo size="sm" />
              </Link>
              <Link
                href="/"
                className="text-xs font-medium text-slate-500 hover:text-neutral-900"
              >
                Все компании →
              </Link>
            </div>
          </div>
        </div>
      )}

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

            <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex items-center gap-2.5">
              {isServiceMode ? (
                <button
                  type="button"
                  onClick={() => {
                    const svc = activeProduct;
                    setActiveProduct(null);
                    openBookingModal(svc);
                  }}
                  className="w-full py-3.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Записаться — {formatKZT(activeProduct.price)}</span>
                </button>
              ) : (cart[activeProduct.id] || 0) > 0 ? (
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

      {/* SERVICE BOOKING MODAL */}
      {bookingService && (
        <div
          onClick={() => setBookingService(null)}
          className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-neutral-950" />
                <h2 className="text-lg font-bold text-neutral-950">Запись на услугу</h2>
              </div>
              <button
                onClick={() => setBookingService(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="booking-form"
              onSubmit={handleBookingSubmit}
              className="flex-1 overflow-y-auto p-5 space-y-5"
            >
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-sm text-neutral-950">
                    {bookingService.name}
                  </div>
                  {bookingService.duration_label && (
                    <div className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {bookingService.duration_label}
                    </div>
                  )}
                </div>
                <div className="font-extrabold text-base text-neutral-950 shrink-0">
                  {formatKZT(bookingService.price)}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Выберите дату
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Сегодня", iso: getLocalIsoDate(0) },
                    { label: "Завтра", iso: getLocalIsoDate(1) },
                    { label: "Послезавтра", iso: getLocalIsoDate(2) },
                  ].map((d) => (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => setBookingDate(d.iso)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition ${
                        bookingDate === d.iso
                          ? "bg-neutral-950 text-white border-neutral-950"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  min={getLocalIsoDate(0)}
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Желаемое время
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setBookingTime(slot)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition ${
                        bookingTime === slot
                          ? "bg-neutral-950 text-white border-neutral-950"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                <input
                  type="time"
                  value={bookingTime}
                  onChange={(e) => setBookingTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                        <div className="min-w-0">
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

              <div className="space-y-2.5">
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
                <div className="space-y-1">
                  <input
                    type="tel"
                    placeholder="Ваш телефон (+7 7XX XXX XX XX)"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 ${
                      kaspiPhoneInvalid
                        ? "border-amber-400 bg-amber-50/40"
                        : "border-slate-300"
                    }`}
                    required
                  />
                  {paymentMethod === "Kaspi Pay" && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-800 px-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        {kaspiPhoneInvalid
                          ? "Для оплаты через Kaspi Pay укажите полный номер (+7 7XX XXX XX XX)"
                          : "Номер подтверждён — можно перейти к оплате Kaspi Pay"}
                      </span>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Комментарий (марка авто, мастер, пожелания)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              {bookingError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  {bookingError}
                </div>
              )}
            </form>

            <div className="p-4 border-t border-slate-200 bg-white shrink-0">
              <button
                type="submit"
                form="booking-form"
                disabled={submittingBooking || kaspiPhoneInvalid}
                className="w-full py-3.5 rounded-xl bg-neutral-950 text-white font-semibold text-sm hover:bg-neutral-800 disabled:opacity-50 transition"
              >
                {submittingBooking
                  ? "Отправляем запись..."
                  : `Подтвердить запись (${formatIsoDateRu(bookingDate)}, ${bookingTime})`}
              </button>
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
                              {opt.badge === "freedom" && (
                                <span className="w-7 h-7 rounded-lg bg-[#00B140] text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                                  F
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
                    <div className="space-y-1">
                      <input
                        type="tel"
                        placeholder="Ваш телефон (+7 7XX XXX XX XX)"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 ${
                          kaspiPhoneInvalid
                            ? "border-amber-400 bg-amber-50/40"
                            : "border-slate-300"
                        }`}
                        required
                      />
                      {paymentMethod === "Kaspi Pay" && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-800 px-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            {kaspiPhoneInvalid
                              ? "Для оплаты через Kaspi Pay обязательно укажите номер (+7 7XX XXX XX XX)"
                              : "Номер указан верно — после оплаты сможете прикрепить чек прямо здесь"}
                          </span>
                        </div>
                      )}
                    </div>
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
                  disabled={submittingOrder || kaspiPhoneInvalid}
                  className="w-full py-3.5 rounded-xl bg-neutral-950 text-white font-semibold text-sm hover:bg-neutral-800 disabled:opacity-50 transition"
                >
                  {submittingOrder
                    ? "Переходим к оплате..."
                    : paymentMethod === "Halyk ePay" || paymentMethod === "Freedom Pay"
                    ? `Оплатить онлайн (${formatKZT(cartTotal)})`
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
                    {orderResult.isBooking
                      ? `Запись ${orderResult.orderCode} принята!`
                      : `Заказ ${orderResult.orderCode} принят!`}
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
              {orderResult.isBooking && orderResult.serviceName && (
                <div className="pb-2 border-b border-slate-200/70 space-y-0.5">
                  <div className="text-sm font-bold text-neutral-950">
                    {orderResult.serviceName}
                  </div>
                  {orderResult.bookingDateTime && (
                    <div className="text-xs font-semibold text-blue-700">
                      Дата и время: {orderResult.bookingDateTime}
                    </div>
                  )}
                </div>
              )}
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
              <div className="space-y-3">
                {/* Step 1: Pay via Kaspi */}
                <a
                  href={kaspiLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#F14635] hover:bg-[#d93b2b] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-xs font-extrabold">
                    1
                  </span>
                  <span>Оплатить через Kaspi Pay</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* Step 2: Upload Receipt right here on the site */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-neutral-950 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span className="text-xs font-bold text-neutral-950">
                      Прикрепите чек об оплате прямо здесь
                    </span>
                  </div>

                  {receiptUploadedUrl ? (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Чек отправлен в компанию вместе с заказом!</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <a
                          href={receiptUploadedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Открыть загруженный чек
                        </a>
                        <label className="text-[11px] font-medium text-slate-500 hover:text-neutral-900 cursor-pointer">
                          Заменить
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleUploadReceipt}
                            disabled={uploadingReceipt}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        После оплаты в Kaspi.kz вернитесь сюда и прикрепите скриншот или PDF-чек — он
                        мгновенно придёт менеджеру вместе с вашим заказом (в WhatsApp писать не нужно).
                      </p>
                      <label className="w-full py-3 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-sm">
                        <Upload className="w-4 h-4" />
                        <span>
                          {uploadingReceipt
                            ? "Отправляем чек..."
                            : "Прикрепить чек (фото или PDF)"}
                        </span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleUploadReceipt}
                          disabled={uploadingReceipt}
                          className="hidden"
                        />
                      </label>
                    </>
                  )}

                  {receiptError && (
                    <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      {receiptError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {waNumber && (
              <a
                href={buildWhatsappReceiptUrl(orderResult)}
                target="_blank"
                rel="noreferrer"
                className={
                  orderResult.paymentMethod === "Kaspi Pay"
                    ? "w-full py-2 px-3 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                    : "w-full py-3 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-sm flex items-center justify-center gap-2 transition"
                }
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>
                  {orderResult.paymentMethod === "Kaspi Pay"
                    ? "Есть вопрос? Написать в WhatsApp"
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

      {/* BANK PAYMENT RETURN STATUS MODAL */}
      {paymentReturnModal && (
        <div
          onClick={() => setPaymentReturnModal(null)}
          className="fixed inset-0 bg-black/55 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl text-center"
          >
            {paymentReturnModal.status === "success" ? (
              <>
                <span className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </span>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-neutral-950">
                    Оплата прошла успешно!
                  </h2>
                  <p className="text-sm text-slate-500">
                    {paymentReturnModal.orderCode
                      ? `Заказ ${paymentReturnModal.orderCode} оплачен через ${paymentReturnModal.provider} и уже передан в работу компании «${business.name}».`
                      : `Ваш заказ оплачен через ${paymentReturnModal.provider} и передан в работу.`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <span className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                  <X className="w-8 h-8" />
                </span>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-neutral-950">
                    Оплата не завершена
                  </h2>
                  <p className="text-sm text-slate-500">
                    {paymentReturnModal.orderCode
                      ? `Платёж по заказу ${paymentReturnModal.orderCode} был отменён или отклонён банком. Вы можете попробовать снова или выбрать другой способ оплаты.`
                      : "Платёж был отменён. Вы можете попробовать снова."}
                  </p>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setPaymentReturnModal(null)}
              className="w-full py-3.5 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-semibold transition"
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
