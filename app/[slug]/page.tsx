"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Upload,
  FileText,
  ShieldCheck,
  Store,
  LayoutGrid,
  ClipboardList,
  Search,
  Volume2,
  VolumeX,
  Play,
  Percent,
  RefreshCw,
  Flag,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  Business,
  Product,
  BusinessSlide,
  BusinessCategory,
  OrderStatus,
  PaymentStatus,
  ClientDeliverySummary,
} from "@/lib/types";
import { formatKZT, formatDate, cleanPhoneForWa, cleanTelegramHandle } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { CATEGORY_PRESETS, CategoryPreset } from "@/lib/categoryPresets";
import { evaluateClientDelivery } from "@/lib/deliveryPricing";

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

interface ClientOrderRecord {
  id: string;
  order_code: string;
  status: OrderStatus;
  payment_method: string;
  payment_status?: PaymentStatus;
  delivery_method?: string;
  total_price: number;
  items: { name: string; price: number; quantity: number }[];
  receipt_url?: string;
  delivery?: ClientDeliverySummary | null;
  created_at: string;
}

interface FlyingItem {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  image?: string;
}

interface DisplayCategory {
  name: string;
  imageUrl: string;
  iconKey: string;
  count: number;
}

type BottomTab = "shop" | "catalog" | "orders";

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

const BADGE_META: Record<string, { label: string; className: string }> = {
  hit: { label: "Хит", className: "bg-amber-500 text-white" },
  new: { label: "Новинка", className: "bg-indigo-600 text-white" },
  discount: { label: "Скидка", className: "bg-rose-600 text-white" },
  in_stock: { label: "В наличии", className: "bg-emerald-50 text-emerald-700" },
};

const CLIENT_ORDER_STATUS: Record<string, { label: string; className: string }> = {
  new: { label: "Принят", className: "bg-blue-50 text-blue-700" },
  in_progress: { label: "В работе", className: "bg-amber-50 text-amber-800" },
  done: { label: "Выполнен", className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Отменён", className: "bg-slate-100 text-slate-500" },
};

const CLIENT_DELIVERY_STATUS: Record<string, string> = {
  queued: "Заявка на курьера в очереди",
  estimating: "Подбираем тариф доставки",
  request_sent: "Отправляем заявку курьеру",
  ready_for_approval: "Подтверждаем доставку",
  searching_courier: "Ищем свободного курьера",
  courier_found: "Курьер назначен и едет в магазин",
  picked_up: "Курьер забрал заказ и едет к вам",
  delivered: "Заказ доставлен курьером",
  cancelled: "Доставка отменена",
  failed: "Не удалось назначить курьера",
  needs_attention: "Уточняем детали доставки",
};

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

function getSavedOrderCodes(businessId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`tiyin_my_orders_${businessId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveOrderCodeLocally(businessId: string, orderCode: string) {
  if (typeof window === "undefined" || !orderCode) return;
  try {
    const existing = getSavedOrderCodes(businessId);
    const next = [orderCode, ...existing.filter((c) => c !== orderCode)].slice(0, 30);
    window.localStorage.setItem(`tiyin_my_orders_${businessId}`, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
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

function StorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24 animate-pulse">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 h-14 px-4 flex items-center justify-between max-w-2xl mx-auto">
        <div className="w-8 h-8 rounded-xl bg-slate-200/80" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-200/80" />
          <div className="w-28 h-4 rounded-md bg-slate-200/80" />
        </div>
        <div className="w-8 h-8 rounded-xl bg-slate-200/80" />
      </div>
      <div className="max-w-2xl mx-auto px-3.5 pt-3.5 space-y-5">
        <div className="flex gap-3 overflow-hidden">
          <div className="w-[82%] h-36 rounded-2xl bg-slate-200/80 shrink-0" />
          <div className="w-[40%] h-36 rounded-2xl bg-slate-200/60 shrink-0" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-slate-200/80" />
              <div className="w-12 h-2.5 rounded bg-slate-200/70" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-2.5 space-y-2.5">
              <div className="aspect-square rounded-xl bg-slate-200/75" />
              <div className="h-3.5 w-3/4 rounded bg-slate-200/80" />
              <div className="h-3 w-1/2 rounded bg-slate-200/60" />
              <div className="flex items-center justify-between pt-1">
                <div className="h-5 w-16 rounded bg-slate-200/80" />
                <div className="w-9 h-9 rounded-xl bg-slate-200/80" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BusinessStorefrontPage() {
  const params = useParams();
  const slug = String(params?.slug || "");

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [slides, setSlides] = useState<BusinessSlide[]>([]);
  const [customCategories, setCustomCategories] = useState<BusinessCategory[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);

  const [bottomTab, setBottomTab] = useState<BottomTab>("shop");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSelectedCat, setCatalogSelectedCat] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Подозрение на мошенничество");
  const [reportDetails, setReportDetails] = useState("");
  const [reportOrderCode, setReportOrderCode] = useState("");
  const [reportContact, setReportContact] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState("");

  // Fullscreen Slide Story Viewer
  const [activeSlide, setActiveSlide] = useState<BusinessSlide | null>(null);
  const [slideMuted, setSlideMuted] = useState(false);

  // Cart + Micro-animations
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartBounce, setCartBounce] = useState(false);
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const cartNavRef = useRef<HTMLButtonElement | null>(null);

  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Client Order History ("Мои заказы")
  const [myOrders, setMyOrders] = useState<ClientOrderRecord[]>([]);
  const [loadingMyOrders, setLoadingMyOrders] = useState(false);

  // Services mode booking
  const [bookingService, setBookingService] = useState<Product | null>(null);
  const [bookingDate, setBookingDate] = useState(() => getLocalIsoDate(0));
  const [bookingTime, setBookingTime] = useState("12:00");
  const [bookingError, setBookingError] = useState("");
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [checkoutTermsAccepted, setCheckoutTermsAccepted] = useState(false);
  const [bookingTermsAccepted, setBookingTermsAccepted] = useState(false);
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

  const loadMyOrders = useCallback(async (businessId: string) => {
    const codes = getSavedOrderCodes(businessId);
    if (codes.length === 0) {
      setMyOrders([]);
      return;
    }
    setLoadingMyOrders(true);
    try {
      const res = await fetch("/api/orders/client-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, orderCodes: codes }),
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.orders)) {
          setMyOrders(json.orders);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingMyOrders(false);
    }
  }, []);

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
        window.history.replaceState({}, "", window.location.pathname);
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
        setPaymentMethod(
          typedBiz.storefront_template === "services"
            ? "Оплата на месте"
            : "Оплата при получении / Уточнить"
        );
      }

      const [prodRes, slidesRes, catsRes, aiRes] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("business_id", typedBiz.id)
          .eq("is_available", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("business_slides")
          .select("*")
          .eq("business_id", typedBiz.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("business_categories")
          .select("*")
          .eq("business_id", typedBiz.id)
          .order("sort_order", { ascending: true }),
        fetch(`/api/ai-status?businessId=${typedBiz.id}`),
      ]);

      setProducts((prodRes.data as Product[]) || []);
      setSlides((slidesRes.data as BusinessSlide[]) || []);
      setCustomCategories((catsRes.data as BusinessCategory[]) || []);

      if (aiRes.ok) {
        const aiJson = await aiRes.json();
        setAiEnabled(Boolean(aiJson.ai_enabled));
      }

      setLoading(false);
      loadMyOrders(typedBiz.id);
    };

    if (slug) loadStorefront();
  }, [slug, loadMyOrders]);

  if (loading) {
    return <StorefrontSkeleton />;
  }

  if (!business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-[#F7F8FA]">
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

  const brandColor = (business.brand_color || "#111827").trim() || "#111827";
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
    id: isServiceMode ? "Оплата на месте" : "Оплата при получении / Уточнить",
    label: isServiceMode ? "Оплата на месте" : "Оплата при получении / Уточнить",
    hint: isServiceMode
      ? "После оказания услуги картой или наличными"
      : "Наличными или по согласованию с менеджером",
  });

  // Build unified visual categories (merging business_categories + product categories)
  const categoryCounts: Record<string, number> = {};
  const categoryFirstImage: Record<string, string> = {};
  for (const p of products) {
    const cat = (p.category || "").trim();
    if (cat) {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      if (!categoryFirstImage[cat] && p.image_url?.trim()) {
        categoryFirstImage[cat] = p.image_url.trim();
      }
    }
  }

  const displayCategories: DisplayCategory[] = [];
  const addedCatNames = new Set<string>();

  const presetByKey = new Map<string, CategoryPreset>(
    CATEGORY_PRESETS.map((p) => [p.key, p])
  );

  for (const cc of customCategories) {
    const cleanName = (cc.name || "").trim();
    const low = cleanName.toLowerCase();
    if (!cleanName || low === "основное" || addedCatNames.has(low)) continue;
    addedCatNames.add(low);
    displayCategories.push({
      name: cleanName,
      imageUrl: cc.image_url?.trim() || categoryFirstImage[cleanName] || "",
      iconKey: cc.icon_key || "",
      count: categoryCounts[cleanName] || 0,
    });
  }

  for (const [catName, cnt] of Object.entries(categoryCounts)) {
    const low = catName.toLowerCase();
    if (low === "основное" || addedCatNames.has(low)) continue;
    addedCatNames.add(low);
    displayCategories.push({
      name: catName,
      imageUrl: categoryFirstImage[catName] || "",
      iconKey: "",
      count: cnt,
    });
  }

  const discountedProducts = products.filter(
    (p) =>
      (p.old_price && p.old_price > p.price) ||
      (Array.isArray(p.badges) && p.badges.includes("discount"))
  );

  const filteredProducts =
    selectedCategory === "Все"
      ? products
      : selectedCategory === "__DISCOUNT__"
      ? discountedProducts
      : products.filter((p) => (p.category || "").trim() === selectedCategory);

  const catalogSearchTrim = catalogSearch.trim().toLowerCase();
  const catalogFilteredProducts = products.filter((p) => {
    if (catalogSearchTrim) {
      const hay = `${p.name} ${p.description || ""} ${p.category || ""}`.toLowerCase();
      if (!hay.includes(catalogSearchTrim)) return false;
    }
    if (catalogSelectedCat === "__DISCOUNT__") {
      return (
        (p.old_price && p.old_price > p.price) ||
        (Array.isArray(p.badges) && p.badges.includes("discount"))
      );
    }
    if (catalogSelectedCat) {
      return (p.category || "").trim() === catalogSelectedCat;
    }
    return true;
  });

  const triggerFlyToCart = (
    product: Product,
    sourceEl?: HTMLElement | null
  ) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        // ignore on unsupported devices
      }
    }

    setCartBounce(true);
    setTimeout(() => setCartBounce(false), 380);

    if (!sourceEl || !cartNavRef.current || typeof window === "undefined") return;
    const fromRect = sourceEl.getBoundingClientRect();
    const toRect = cartNavRef.current.getBoundingClientRect();
    const flyId = Date.now() + Math.random();

    setFlyingItems((prev) => [
      ...prev,
      {
        id: flyId,
        startX: fromRect.left + fromRect.width / 2,
        startY: fromRect.top + fromRect.height / 2,
        endX: toRect.left + toRect.width / 2,
        endY: toRect.top + toRect.height / 2,
        image: product.image_url?.trim() || undefined,
      },
    ]);

    setTimeout(() => {
      setFlyingItems((prev) => prev.filter((item) => item.id !== flyId));
    }, 520);
  };

  const addToCart = (product: Product, sourceEl?: HTMLElement | null) => {
    setCart((prev) => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
    triggerFlyToCart(product, sourceEl);
    setAddedToast(`«${product.name}» в корзине`);
    setTimeout(() => setAddedToast(""), 1600);
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

  const openBookingModal = (service: Product) => {
    setBookingService(service);
    setBookingDate(getLocalIsoDate(0));
    setBookingTime("12:00");
    setBookingError("");
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
  const deliveryEval = evaluateClientDelivery(business, cartTotal);
  const activeDeliveryFee =
    deliveryMethod === "Доставка курьером" && deliveryEval.enabled
      ? deliveryEval.fee
      : 0;
  const checkoutGrandTotal = cartTotal + activeDeliveryFee;
  const deliveryMinBlocked =
    deliveryMethod === "Доставка курьером" &&
    deliveryEval.enabled &&
    deliveryEval.minOrderNotMet;

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
    if (deliveryMinBlocked && deliveryEval.minOrderAmount) {
      setOrderError(
        `Доставка курьером доступна при заказе от ${formatKZT(
          deliveryEval.minOrderAmount
        )}. Добавьте ещё на ${formatKZT(deliveryEval.amountToMinOrder)} или выберите самовывоз.`
      );
      return;
    }
    if (!checkoutTermsAccepted) {
      setOrderError("Поставьте галочку согласия с Пользовательским соглашением и Политикой конфиденциальности.");
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
          deliveryAddress:
            deliveryMethod === "Доставка курьером" ? deliveryAddress.trim() : "",
          termsAccepted: checkoutTermsAccepted,
          source: "web",
          items: cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.orderCode) {
          saveOrderCodeLocally(business.id, json.orderCode);
          loadMyOrders(business.id);
        }

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
          totalPrice: Number(json.totalPrice ?? checkoutGrandTotal),
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
    if (!bookingTermsAccepted) {
      setBookingError("Поставьте галочку согласия с Пользовательским соглашением и Политикой конфиденциальности.");
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
          termsAccepted: bookingTermsAccepted,
          source: "web",
          items: [{ productId: bookingService.id, quantity: 1 }],
        }),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.orderCode) {
          saveOrderCodeLocally(business.id, json.orderCode);
          loadMyOrders(business.id);
        }

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
        loadMyOrders(business.id);
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

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setSubmittingReport(true);
    setReportError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          reason: reportReason,
          details: reportDetails.trim(),
          orderCode: reportOrderCode.trim(),
          reporterContact: reportContact.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setReportError(json.error || "Не удалось отправить обращение.");
        return;
      }
      setReportSent(true);
      setReportDetails("");
      setReportOrderCode("");
    } catch {
      setReportError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setSubmittingReport(false);
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
        saveOrderCodeLocally(business.id, json.orderCreated.orderCode);
        loadMyOrders(business.id);
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
  const businessInitials = (business.pwa_short_name || business.name || "TS")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const renderProductCard = (product: Product) => {
    const qty = cart[product.id] || 0;
    const photos = getProductPhotos(product);
    const mainPhoto = photos[0];
    const hasDiscount = Boolean(product.old_price && product.old_price > product.price);
    const discountPct = hasDiscount
      ? Math.round(
          ((Number(product.old_price) - product.price) / Number(product.old_price)) * 100
        )
      : 0;
    const rawBadges = Array.isArray(product.badges) ? product.badges : [];
    const topBadges = rawBadges.filter((b) => b !== "in_stock");
    const hasInStockBadge = rawBadges.includes("in_stock");
    const cashback = Number(product.cashback_percent || 0);

    return (
      <div
        key={product.id}
        onClick={() => openProductModal(product)}
        className="group bg-white rounded-2xl overflow-hidden border border-slate-100 hover:border-slate-200 transition flex flex-col cursor-pointer"
      >
        <div className="relative aspect-square bg-[#F4F5F7] overflow-hidden">
          {mainPhoto ? (
            <img
              src={mainPhoto}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Package className="w-8 h-8" />
            </div>
          )}

          {/* Top-left badges */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[82%]">
            {hasDiscount && discountPct > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold leading-none">
                -{discountPct}%
              </span>
            )}
            {topBadges.map((b) => {
              if (b === "discount" && hasDiscount) return null;
              const meta = BADGE_META[b];
              if (!meta) return null;
              return (
                <span
                  key={b}
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none ${meta.className}`}
                >
                  {meta.label}
                </span>
              );
            })}
          </div>

          {photos.length > 1 && (
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/45 backdrop-blur-sm text-white text-[10px] font-semibold">
              1/{photos.length}
            </span>
          )}
        </div>

        <div className="p-3 flex-1 flex flex-col justify-between gap-2">
          <div className="space-y-1">
            {(cashback > 0 || hasInStockBadge) && (
              <div className="flex flex-wrap items-center gap-1">
                {cashback > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#48B81A] text-white text-[10px] font-extrabold leading-none">
                    {cashback}% Б
                  </span>
                )}
                {hasInStockBadge && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold leading-none">
                    В наличии
                  </span>
                )}
              </div>
            )}

            <div className="font-medium text-[13px] text-neutral-900 line-clamp-2 leading-snug">
              {product.name}
            </div>
            {product.description && (
              <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex items-end justify-between gap-1.5 pt-1">
            <div className="min-w-0">
              {hasDiscount && product.old_price && (
                <div className="text-[11px] text-slate-400 line-through leading-none mb-0.5">
                  {formatKZT(product.old_price)}
                </div>
              )}
              <div className="font-extrabold text-[16px] text-neutral-950 tracking-tight leading-none">
                {formatKZT(product.price)}
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                addToCart(product, e.currentTarget);
              }}
              aria-label="Добавить в корзину"
              style={{ backgroundColor: qty > 0 ? "#10b981" : brandColor }}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm transition-transform duration-150 active:scale-90 hover:opacity-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-neutral-950 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                {qty > 0 ? qty : "+"}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24">
      <style>{`
        @keyframes tiyinFly {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          70% {
            opacity: 0.9;
          }
          100% {
            transform: translate(calc(var(--dx) - 50%), calc(var(--dy) - 50%)) scale(0.35);
            opacity: 0;
          }
        }
        .tiyin-fly-dot {
          animation: tiyinFly 0.48s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>

      {/* FLY-TO-CART ANIMATION LAYER */}
      {flyingItems.map((fi) => (
        <div
          key={fi.id}
          className="fixed z-[70] pointer-events-none tiyin-fly-dot w-9 h-9 rounded-full overflow-hidden shadow-lg border-2 border-white flex items-center justify-center"
          style={
            {
              left: `${fi.startX}px`,
              top: `${fi.startY}px`,
              backgroundColor: brandColor,
              "--dx": `${fi.endX - fi.startX}px`,
              "--dy": `${fi.endY - fi.startY}px`,
            } as React.CSSProperties
          }
        >
          {fi.image ? (
            <img src={fi.image} alt="" className="w-full h-full object-cover" />
          ) : (
            <ShoppingCart className="w-4 h-4 text-white" />
          )}
        </div>
      ))}

      {/* CLEAN MINIMAL TOP BAR (NO COVER BANNER) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-3.5 h-14 flex items-center justify-between gap-2">
          <Link
            href="/"
            aria-label="Назад к поиску"
            className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-neutral-800 transition shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition"
          >
            <div
              className="w-8 h-8 rounded-xl text-white text-[11px] font-extrabold overflow-hidden flex items-center justify-center shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {business.logo_url ? (
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                businessInitials
              )}
            </div>
            <span className="font-bold text-[15px] text-neutral-950 truncate tracking-tight">
              {business.pwa_short_name || business.name}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="О магазине и меню"
            className="w-9 h-9 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 text-neutral-900 flex items-center justify-center transition shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Quick Toast */}
      {addedToast && (
        <div className="fixed top-16 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="bg-neutral-950/90 backdrop-blur text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg">
            {addedToast}
          </div>
        </div>
      )}

      {/* MAIN CONTENT BY BOTTOM TAB */}
      <div className="max-w-2xl mx-auto">
        {/* ================= TAB 1: МАГАЗИН ================= */}
        {bottomTab === "shop" && (
          <div className="pt-3 space-y-4">
            {/* PROMO / VIDEO SLIDES CAROUSEL */}
            {slides.length > 0 && (
              <div className="px-3.5">
                <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x snap-mandatory no-scrollbar">
                  {slides.map((slide) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => {
                        setSlideMuted(false);
                        setActiveSlide(slide);
                      }}
                      className="relative w-[82%] sm:w-[300px] h-36 sm:h-40 rounded-2xl overflow-hidden shrink-0 snap-start bg-neutral-900 text-left group"
                    >
                      {slide.media_type === "video" ? (
                        <video
                          src={slide.media_url}
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={slide.media_url}
                          alt={slide.title || "Акция"}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-300"
                        />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                      {slide.badge_text && (
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-white/95 text-neutral-950 text-[10px] font-extrabold shadow-sm">
                          {slide.badge_text}
                        </span>
                      )}

                      {slide.media_type === "video" && (
                        <span className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center">
                          <VolumeX className="w-3.5 h-3.5" />
                        </span>
                      )}

                      {(slide.title || slide.subtitle) && (
                        <div className="absolute bottom-2.5 inset-x-3 text-white">
                          {slide.title && (
                            <div className="font-bold text-sm leading-tight line-clamp-1">
                              {slide.title}
                            </div>
                          )}
                          {slide.subtitle && (
                            <div className="text-[11px] text-white/80 line-clamp-1 mt-0.5">
                              {slide.subtitle}
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {slides.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-2">
                    {slides.map((s) => (
                      <span
                        key={s.id}
                        className="w-1.5 h-1.5 rounded-full bg-slate-300"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* HORIZONTAL VISUAL CATEGORIES STRIP (ONLY REAL CATEGORIES, TAP AGAIN TO RESET) */}
            {displayCategories.length > 0 && (
              <div className="px-3.5">
                <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {displayCategories.map((cat) => {
                    const active = selectedCategory === cat.name;
                    const preset = cat.iconKey ? presetByKey.get(cat.iconKey) : undefined;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() =>
                          setSelectedCategory((prev) =>
                            prev === cat.name ? "Все" : cat.name
                          )
                        }
                        className="flex flex-col items-center gap-1.5 shrink-0 w-[66px]"
                      >
                        <div
                          className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center transition border-2"
                          style={{
                            borderColor: active ? brandColor : "#F1F5F9",
                            backgroundColor:
                              !cat.imageUrl && preset ? preset.bg : "#FFFFFF",
                          }}
                        >
                          {cat.imageUrl ? (
                            <img
                              src={cat.imageUrl}
                              alt={cat.name}
                              className="w-full h-full object-cover"
                            />
                          ) : preset ? (
                            <span className="text-2xl">{preset.emoji}</span>
                          ) : (
                            <span className="text-sm font-bold text-slate-500">
                              {cat.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[11px] leading-tight text-center line-clamp-2 ${
                            active
                              ? "font-bold text-neutral-950"
                              : "font-medium text-slate-600"
                          }`}
                        >
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* UPFRONT DELIVERY CONDITIONS PILL (VISIBLE WHILE BROWSING) */}
            {!isServiceMode && deliveryEval.enabled && deliveryEval.shortBadge && (
              <div className="px-3.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200/80 text-[11px] font-semibold text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <Truck className="w-3.5 h-3.5 shrink-0" style={{ color: brandColor }} />
                  <span>{deliveryEval.shortBadge}</span>
                </div>
              </div>
            )}

            {/* PRODUCTS GRID OR SERVICES LIST */}
            <main className="px-3.5">
              {selectedCategory !== "Все" && (
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="font-bold text-base text-neutral-950">
                    {selectedCategory === "__DISCOUNT__"
                      ? "Товары со скидкой"
                      : selectedCategory}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("Все")}
                    className="text-xs font-semibold text-slate-500 hover:text-neutral-900"
                  >
                    Сбросить
                  </button>
                </div>
              )}

              {filteredProducts.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center text-sm text-slate-500 space-y-3">
                  <p>
                    {isServiceMode
                      ? "Список услуг пока наполняется."
                      : "В этом разделе пока нет товаров."}
                  </p>
                  {selectedCategory !== "Все" ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("Все")}
                      className="px-4 py-2 rounded-xl text-white text-xs font-semibold"
                      style={{ backgroundColor: brandColor }}
                    >
                      Показать все
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMenuOpen(true)}
                      className="px-4 py-2 rounded-xl text-white text-xs font-semibold"
                      style={{ backgroundColor: brandColor }}
                    >
                      Контакты компании
                    </button>
                  )}
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
                        className="bg-white rounded-2xl border border-slate-100 p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-200 transition"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {mainPhoto && (
                            <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                              <img
                                src={mainPhoto}
                                alt={service.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm text-neutral-950 leading-snug">
                              {service.name}
                            </div>
                            {service.description && (
                              <p className="text-xs text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                                {service.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="font-extrabold text-[15px] text-neutral-950">
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
                          style={{ backgroundColor: brandColor }}
                          className="px-3.5 py-2.5 rounded-xl text-white text-xs font-semibold shrink-0 transition active:scale-95"
                        >
                          Записаться
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {filteredProducts.map((product) => renderProductCard(product))}
                </div>
              )}
            </main>
          </div>
        )}

        {/* ================= TAB 2: КАТАЛОГ (3-COLUMN VISUAL GRID + SEARCH) ================= */}
        {bottomTab === "catalog" && (
          <div className="px-3.5 pt-3.5 space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder={isServiceMode ? "Поиск услуги..." : "Поиск товара..."}
                className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-slate-200/80 text-sm text-neutral-950 placeholder:text-slate-400 focus:outline-none focus:border-neutral-400"
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => setCatalogSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* If searching OR a category is chosen: show matching products */}
            {catalogSearchTrim || catalogSelectedCat ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSelectedCat(null);
                      setCatalogSearch("");
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-neutral-950"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Все категории</span>
                  </button>
                  <span className="text-xs font-bold text-neutral-900 truncate">
                    {catalogSelectedCat === "__DISCOUNT__"
                      ? "Товары со скидкой"
                      : catalogSelectedCat || `Найдено: ${catalogFilteredProducts.length}`}
                  </span>
                </div>

                {catalogFilteredProducts.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 text-center text-sm text-slate-500 border border-slate-100">
                    Ничего не найдено по запросу.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    {catalogFilteredProducts.map((p) => renderProductCard(p))}
                  </div>
                )}
              </div>
            ) : (
              /* 3-Column Visual Category Tiles (like Reference Photo 2) */
              <div className="space-y-3">
                <h1 className="font-bold text-lg text-neutral-950 px-0.5">
                  {isServiceMode ? "Разделы услуг" : "Каталог товаров"}
                </h1>

                <div className="grid grid-cols-3 gap-2.5">
                  {discountedProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCatalogSelectedCat("__DISCOUNT__")}
                      className="bg-rose-50 hover:bg-rose-100/80 rounded-2xl p-2.5 h-32 flex flex-col justify-between text-left transition overflow-hidden relative"
                    >
                      <span className="text-[11px] font-bold text-rose-900 leading-tight line-clamp-2 z-10">
                        Товары со скидками
                      </span>
                      <div className="self-end w-11 h-11 rounded-xl bg-rose-500 text-white flex items-center justify-center">
                        <Percent className="w-6 h-6" />
                      </div>
                    </button>
                  )}

                  {displayCategories.map((cat) => {
                    const preset = cat.iconKey ? presetByKey.get(cat.iconKey) : undefined;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setCatalogSelectedCat(cat.name)}
                        className="bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl p-2.5 h-32 flex flex-col justify-between text-left transition overflow-hidden relative"
                      >
                        <span className="text-[11px] font-semibold text-neutral-900 leading-tight line-clamp-2 z-10">
                          {cat.name}
                        </span>
                        <div
                          className="self-end w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor:
                              !cat.imageUrl && preset ? preset.bg : "#F1F5F9",
                          }}
                        >
                          {cat.imageUrl ? (
                            <img
                              src={cat.imageUrl}
                              alt={cat.name}
                              className="w-full h-full object-cover"
                            />
                          ) : preset ? (
                            <span className="text-3xl">{preset.emoji}</span>
                          ) : (
                            <Package className="w-6 h-6 text-slate-300" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: МОИ ЗАКАЗЫ ================= */}
        {bottomTab === "orders" && (
          <div className="px-3.5 pt-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="font-bold text-lg text-neutral-950">Мои заказы</h1>
                <p className="text-xs text-slate-500">
                  История ваших заказов в «{business.pwa_short_name || business.name}»
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadMyOrders(business.id)}
                disabled={loadingMyOrders}
                className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
                title="Обновить статусы"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingMyOrders ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {loadingMyOrders && myOrders.length === 0 ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 h-28" />
                ))}
              </div>
            ) : myOrders.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center space-y-3">
                <ClipboardList className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-semibold text-neutral-900">
                  У вас пока нет заказов
                </div>
                <p className="text-xs text-slate-500">
                  После оформления заказа или записи его статус автоматически появится здесь.
                </p>
                <button
                  type="button"
                  onClick={() => setBottomTab("shop")}
                  style={{ backgroundColor: brandColor }}
                  className="px-4 py-2.5 rounded-xl text-white text-xs font-semibold"
                >
                  Перейти к покупкам
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.map((ord) => {
                  const st =
                    CLIENT_ORDER_STATUS[ord.status] || CLIENT_ORDER_STATUS.new;
                  const isKaspiUnpaid =
                    (ord.payment_method || "").toLowerCase().includes("kaspi") &&
                    !ord.receipt_url &&
                    ord.payment_status !== "paid";

                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-neutral-950">
                            {ord.order_code}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${st.className}`}
                          >
                            {st.label}
                          </span>
                          {ord.payment_status === "paid" && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              Оплачено
                            </span>
                          )}
                          {ord.payment_status === "pending_review" && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800">
                              Чек на проверке
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {formatDate(ord.created_at)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600">
                        {Array.isArray(ord.items)
                          ? ord.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")
                          : ""}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div className="text-xs text-slate-500">
                          {ord.payment_method}
                        </div>
                        <div className="font-extrabold text-sm text-neutral-950">
                          {formatKZT(ord.total_price)}
                        </div>
                      </div>

                      {ord.delivery && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                              <Truck
                                className="w-3.5 h-3.5 shrink-0"
                                style={{ color: brandColor }}
                              />
                              <span>
                                {CLIENT_DELIVERY_STATUS[ord.delivery.status] ||
                                  "Доставка курьером"}
                              </span>
                            </div>
                            {ord.delivery.courier_name && (
                              <div className="text-[11px] text-slate-500">
                                Курьер: {ord.delivery.courier_name}
                              </div>
                            )}
                          </div>
                          {ord.delivery.tracking_url && (
                            <a
                              href={ord.delivery.tracking_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ backgroundColor: brandColor }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold shrink-0 hover:opacity-95 transition"
                            >
                              <span>На карте</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}

                      {isKaspiUnpaid && hasKaspi && (
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptUploadedUrl("");
                            setReceiptError("");
                            setOrderResult({
                              orderId: ord.id,
                              orderCode: ord.order_code,
                              totalPrice: ord.total_price,
                              paymentMethod: ord.payment_method,
                              deliveryMethod: ord.delivery_method || "Самовывоз",
                            });
                          }}
                          className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#F14635] text-xs font-semibold transition"
                        >
                          Оплатить Kaspi / Прикрепить чек
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION BAR (4 TABS: МАГАЗИН | КАТАЛОГ | КОРЗИНА | МОИ ЗАКАЗЫ) */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200/80 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto grid grid-cols-4 h-14 px-2">
          <button
            type="button"
            onClick={() => setBottomTab("shop")}
            className="flex flex-col items-center justify-center gap-0.5 transition"
            style={{ color: bottomTab === "shop" ? brandColor : "#94a3b8" }}
          >
            <Store className="w-5 h-5" />
            <span className="text-[10px] font-semibold leading-none">Магазин</span>
          </button>

          <button
            type="button"
            onClick={() => setBottomTab("catalog")}
            className="flex flex-col items-center justify-center gap-0.5 transition"
            style={{ color: bottomTab === "catalog" ? brandColor : "#94a3b8" }}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] font-semibold leading-none">Каталог</span>
          </button>

          <button
            ref={cartNavRef}
            type="button"
            onClick={() => {
              setOrderError("");
              setCheckoutOpen(true);
            }}
            className={`relative flex flex-col items-center justify-center gap-0.5 transition-transform duration-200 ${
              cartBounce ? "scale-110" : "scale-100"
            }`}
            style={{ color: cartCount > 0 ? brandColor : "#94a3b8" }}
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white"
                  style={{ backgroundColor: brandColor }}
                >
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold leading-none">Корзина</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBottomTab("orders");
              loadMyOrders(business.id);
            }}
            className="flex flex-col items-center justify-center gap-0.5 transition"
            style={{ color: bottomTab === "orders" ? brandColor : "#94a3b8" }}
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-[10px] font-semibold leading-none">Мои заказы</span>
          </button>
        </div>
      </nav>

      {/* FULLSCREEN SLIDE STORY VIEWER (WITH SOUND ON TAP FOR VIDEOS) */}
      {activeSlide && (
        <div
          onClick={() => setActiveSlide(null)}
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-3 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[88vh] rounded-3xl overflow-hidden bg-neutral-950 shadow-2xl flex flex-col"
          >
            <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-2">
              {activeSlide.media_type === "video" && (
                <button
                  type="button"
                  onClick={() => setSlideMuted((prev) => !prev)}
                  className="w-9 h-9 rounded-full bg-black/55 backdrop-blur text-white flex items-center justify-center"
                  aria-label="Включить/выключить звук"
                >
                  {slideMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveSlide(null)}
                className="w-9 h-9 rounded-full bg-black/55 backdrop-blur text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative flex-1 min-h-[360px] max-h-[76vh] bg-black flex items-center justify-center">
              {activeSlide.media_type === "video" ? (
                <video
                  src={activeSlide.media_url}
                  autoPlay
                  loop
                  playsInline
                  muted={slideMuted}
                  controls={false}
                  className="w-full h-full max-h-[76vh] object-contain"
                />
              ) : (
                <img
                  src={activeSlide.media_url}
                  alt={activeSlide.title || "Акция"}
                  className="w-full h-full max-h-[76vh] object-contain"
                />
              )}
            </div>

            {(activeSlide.title || activeSlide.subtitle || activeSlide.link_category) && (
              <div className="p-4 bg-neutral-950 text-white space-y-2.5">
                {activeSlide.badge_text && (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-semibold">
                    {activeSlide.badge_text}
                  </span>
                )}
                {activeSlide.title && (
                  <div className="font-bold text-base leading-snug">
                    {activeSlide.title}
                  </div>
                )}
                {activeSlide.subtitle && (
                  <p className="text-xs text-white/75 leading-relaxed">
                    {activeSlide.subtitle}
                  </p>
                )}
                {activeSlide.link_category && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(activeSlide.link_category);
                      setBottomTab("shop");
                      setActiveSlide(null);
                    }}
                    style={{ backgroundColor: brandColor }}
                    className="w-full py-3 rounded-xl text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Перейти в «{activeSlide.link_category}»</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RIGHT SLIDE-OUT MENU DRAWER (STORE INFO, CONTACTS, 2GIS, PAYMENTS, DELIVERY, PWA) */}
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
                <div
                  className="w-10 h-10 rounded-xl text-white font-extrabold text-xs overflow-hidden flex items-center justify-center shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                  {business.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt={business.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    businessInitials
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
                    О магазине
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
                    Контакты и соцсети
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
                          {deliveryEval.enabled
                            ? deliveryEval.summaryLine
                            : "Доставка курьером"}
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
              {(business.legal_name || business.bin_iin) && (
                <div className="bg-slate-50 rounded-2xl p-3.5 space-y-1 border border-slate-200/70">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Реквизиты продавца
                  </div>
                  {business.legal_name && (
                    <div className="text-xs font-semibold text-neutral-900">
                      {business.legal_name}
                    </div>
                  )}
                  {business.bin_iin && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      ИИН/БИН: {business.bin_iin}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setReportSent(false);
                  setReportError("");
                  setReportOpen(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-slate-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Пожаловаться на магазин</span>
              </button>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
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
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <Link href="/terms" target="_blank" className="hover:text-neutral-700 underline">
                  Соглашение
                </Link>
                <Link href="/privacy" target="_blank" className="hover:text-neutral-700 underline">
                  Конфиденциальность
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING AI CHAT BUTTON (POSITIONED ABOVE BOTTOM NAV) */}
      {aiEnabled && (
        <div className="fixed bottom-20 right-4 z-30">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            style={{ backgroundColor: brandColor }}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl text-white shadow-lg hover:opacity-95 transition text-xs font-semibold max-w-[230px]"
          >
            <Bot className="w-4 h-4 shrink-0" />
            <span className="truncate">Чат с {business.pwa_short_name || business.name}</span>
          </button>
        </div>
      )}

      {/* PRODUCT DETAIL POPUP MODAL (WITH GALLERY + FULL DESCRIPTION + PAYMENT & DELIVERY INFO) */}
      {activeProduct && (
        <div
          onClick={() => setActiveProduct(null)}
          className="fixed inset-0 bg-black/55 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md max-h-[88vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="relative bg-slate-100 aspect-[4/3] shrink-0 overflow-hidden">
              {activePhotos.length > 0 ? (
                <img
                  src={activePhotos[activePhotoIndex] || activePhotos[0]}
                  alt={activeProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  {isServiceMode ? (
                    <Sparkles className="w-12 h-12" />
                  ) : (
                    <Package className="w-12 h-12" />
                  )}
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

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {activeProduct.category &&
                  activeProduct.category.toLowerCase() !== "основное" && (
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
                      {activeProduct.category}
                    </span>
                  )}
                {activeProduct.duration_label && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                    <Clock className="w-3 h-3" />
                    {activeProduct.duration_label}
                  </span>
                )}
                {Number(activeProduct.cashback_percent || 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-[#48B81A] text-white text-[11px] font-bold">
                    {activeProduct.cashback_percent}% Б кэшбэк
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-neutral-950 leading-snug">
                {activeProduct.name}
              </h2>

              <div className="flex items-baseline gap-2.5">
                <div className="text-2xl font-extrabold text-neutral-950 tracking-tight">
                  {formatKZT(activeProduct.price)}
                </div>
                {activeProduct.old_price && activeProduct.old_price > activeProduct.price && (
                  <div className="text-sm text-slate-400 line-through">
                    {formatKZT(activeProduct.old_price)}
                  </div>
                )}
              </div>

              {activeProduct.description && (
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {activeProduct.description}
                </p>
              )}

              {/* Payment & Delivery info right inside Product Modal */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-3.5 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-slate-700">
                  <CreditCard className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-neutral-900">Оплата: </span>
                    {[
                      hasKaspi ? "Kaspi Pay" : "",
                      hasHalykApi ? "Halyk ePay" : hasHalyk ? "Halyk Bank" : "",
                      hasFreedomApi ? "Freedom Pay" : "",
                      isServiceMode ? "на месте" : "при получении",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700">
                  {isServiceMode ? (
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  ) : (
                    <Truck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold text-neutral-900">
                      {isServiceMode ? "Получение: " : "Доставка: "}
                    </span>
                    {isServiceMode
                      ? "Онлайн-запись на удобную дату и время"
                      : deliveryEval.enabled
                      ? `Самовывоз · ${deliveryEval.summaryLine}`
                      : "Самовывоз или доставка курьером"}
                  </div>
                </div>
              </div>
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
                  style={{ backgroundColor: brandColor }}
                  className="w-full py-3.5 rounded-xl text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition shadow-sm"
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
                      onClick={(e) => addToCart(activeProduct, e.currentTarget)}
                      style={{ backgroundColor: brandColor }}
                      className="w-9 h-9 rounded-lg text-white flex items-center justify-center shadow-sm"
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
                    style={{ backgroundColor: brandColor }}
                    className="flex-1 py-3 rounded-xl text-white text-sm font-semibold transition"
                  >
                    Перейти в корзину
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={(e) => addToCart(activeProduct, e.currentTarget)}
                  style={{ backgroundColor: brandColor }}
                  className="w-full py-3.5 rounded-xl text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition shadow-sm"
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

              <label className="flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed cursor-pointer">
                <input
                  type="checkbox"
                  checked={bookingTermsAccepted}
                  onChange={(e) => setBookingTermsAccepted(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 accent-neutral-950 shrink-0"
                  required
                />
                <span>
                  Я принимаю{" "}
                  <Link href="/terms" target="_blank" className="underline font-semibold text-neutral-900">
                    Пользовательское соглашение
                  </Link>{" "}
                  и{" "}
                  <Link href="/privacy" target="_blank" className="underline font-semibold text-neutral-900">
                    Политику конфиденциальности
                  </Link>
                  , и даю согласие на обработку и трансграничную передачу ПД (Telegram, Google AI) для подтверждения записи.
                </span>
              </label>

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
                style={{ backgroundColor: brandColor }}
                className="w-full py-3.5 rounded-xl text-white font-semibold text-sm hover:opacity-95 disabled:opacity-50 transition"
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

                    {/* Free delivery progress bar */}
                    {deliveryEval.enabled &&
                      deliveryEval.mode === "fixed" &&
                      deliveryEval.freeFromAmount &&
                      deliveryEval.freeFromAmount > 0 && (
                        <div className="pt-2 space-y-1.5">
                          {deliveryEval.amountToFreeDelivery > 0 ? (
                            <>
                              <div className="flex items-center justify-between text-[11px] text-slate-600">
                                <span>
                                  Ещё{" "}
                                  <strong className="text-neutral-950">
                                    {formatKZT(deliveryEval.amountToFreeDelivery)}
                                  </strong>{" "}
                                  до бесплатной доставки
                                </span>
                                <span className="font-semibold">
                                  {Math.min(
                                    100,
                                    Math.round(
                                      (cartTotal / deliveryEval.freeFromAmount) * 100
                                    )
                                  )}
                                  %
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.round(
                                        (cartTotal / deliveryEval.freeFromAmount) * 100
                                      )
                                    )}%`,
                                    backgroundColor: brandColor,
                                  }}
                                />
                              </div>
                            </>
                          ) : (
                            <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Доставка курьером будет бесплатной!</span>
                            </div>
                          )}
                        </div>
                      )}

                    <div className="border-t border-slate-200 pt-2.5 space-y-1">
                      {deliveryMethod === "Доставка курьером" && deliveryEval.enabled && (
                        <>
                          <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>Товары</span>
                            <span>{formatKZT(cartTotal)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>Доставка курьером</span>
                            <span
                              className={
                                activeDeliveryFee === 0
                                  ? "font-semibold text-emerald-700"
                                  : "font-semibold text-neutral-900"
                              }
                            >
                              {activeDeliveryFee === 0
                                ? deliveryEval.isIncluded
                                  ? "Включена"
                                  : "Бесплатно"
                                : formatKZT(activeDeliveryFee)}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center pt-0.5">
                        <span className="text-sm font-medium text-slate-600">Итого</span>
                        <span className="text-lg font-bold text-neutral-950">
                          {formatKZT(checkoutGrandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>

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
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-neutral-950">
                                  {opt.label}
                                </span>
                                {opt.id === "Доставка курьером" && deliveryEval.enabled && (
                                  <span
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                      deliveryEval.fee === 0
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-slate-100 text-neutral-900"
                                    }`}
                                  >
                                    {deliveryEval.fee === 0
                                      ? deliveryEval.isIncluded
                                        ? "Включена"
                                        : "Бесплатно"
                                      : formatKZT(deliveryEval.fee)}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {opt.id === "Доставка курьером" && deliveryEval.enabled
                                  ? deliveryEval.summaryLine
                                  : opt.hint}
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

                  <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Данные для заказа
                    </div>

                    {deliveryMinBlocked && deliveryEval.minOrderAmount && (
                      <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                        Доставка курьером доступна при заказе от{" "}
                        <strong>{formatKZT(deliveryEval.minOrderAmount)}</strong>. Добавьте
                        товаров ещё на{" "}
                        <strong>{formatKZT(deliveryEval.amountToMinOrder)}</strong> или
                        выберите самовывоз.
                      </div>
                    )}

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

                    <label className="flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkoutTermsAccepted}
                        onChange={(e) => setCheckoutTermsAccepted(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border-slate-300 accent-neutral-950 shrink-0"
                        required
                      />
                      <span>
                        Я принимаю{" "}
                        <Link href="/terms" target="_blank" className="underline font-semibold text-neutral-900">
                          Пользовательское соглашение
                        </Link>{" "}
                        и{" "}
                        <Link href="/privacy" target="_blank" className="underline font-semibold text-neutral-900">
                          Политику конфиденциальности
                        </Link>
                        , даю согласие на обработку и трансграничную передачу персональных данных (Telegram, Google AI) для исполнения заказа. Продавец: «{business.legal_name || business.name}».
                      </span>
                    </label>

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
                  disabled={submittingOrder || kaspiPhoneInvalid || deliveryMinBlocked}
                  style={{ backgroundColor: brandColor }}
                  className="w-full py-3.5 rounded-xl text-white font-semibold text-sm hover:opacity-95 disabled:opacity-50 transition"
                >
                  {submittingOrder
                    ? "Переходим к оплате..."
                    : paymentMethod === "Halyk ePay" || paymentMethod === "Freedom Pay"
                    ? `Оплатить онлайн (${formatKZT(checkoutGrandTotal)})`
                    : paymentMethod === "Kaspi Pay"
                    ? `Оформить и перейти к Kaspi (${formatKZT(checkoutGrandTotal)})`
                    : `Подтвердить заказ (${formatKZT(checkoutGrandTotal)})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POST-ORDER PAYMENT & KASPI RECEIPT MODAL */}
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
                        мгновенно придёт менеджеру вместе с вашим заказом.
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
              style={{ backgroundColor: brandColor }}
              className="w-full py-3.5 rounded-2xl text-white text-sm font-semibold transition"
            >
              Вернуться на витрину
            </button>
          </div>
        </div>
      )}

      {/* REPORT SHOP MODAL (ANTI-FRAUD ART. 33-1) */}
      {reportOpen && (
        <div
          onClick={() => setReportOpen(false)}
          className="fixed inset-0 bg-black/55 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-red-600" />
                <h2 className="font-bold text-base text-neutral-950">
                  Пожаловаться на магазин
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSent ? (
              <div className="p-6 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <div className="font-bold text-base text-neutral-950">
                  Обращение отправлено
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Администрация TIYIN Space проверит витрину «{business.name}» в течение 3 рабочих дней и примет меры.
                </p>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="w-full py-3 rounded-xl bg-neutral-950 text-white text-xs font-semibold"
                >
                  Закрыть
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Причина жалобы
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="Подозрение на мошенничество">
                      Подозрение на мошенничество
                    </option>
                    <option value="Запрещённый товар или услуга">
                      Запрещённый товар или услуга
                    </option>
                    <option value="Оплатил заказ, товар не доставили">
                      Оплатил заказ, товар не доставили
                    </option>
                    <option value="Недостоверные цены или реквизиты">
                      Недостоверные цены или реквизиты
                    </option>
                    <option value="Другое нарушение">Другое нарушение</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Номер заказа (если есть)
                  </label>
                  <input
                    type="text"
                    value={reportOrderCode}
                    onChange={(e) => setReportOrderCode(e.target.value)}
                    placeholder="Например: ORD-4821"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Опишите ситуацию
                  </label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Расскажите подробнее, что произошло..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Ваш телефон или Telegram для связи
                  </label>
                  <input
                    type="text"
                    value={reportContact}
                    onChange={(e) => setReportContact(e.target.value)}
                    placeholder="+7 7XX XXX XX XX или @username"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                {reportError && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {reportError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingReport}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition"
                >
                  {submittingReport ? "Отправляем..." : "Отправить жалобу"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CHAT MODAL */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md h-[80vh] sm:h-[75vh] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Bot className="w-5 h-5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{business.name}</div>
                  <div className="text-[11px] text-emerald-400">
                    ИИ-ассистент • Вы общаетесь с ИИ
                  </div>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 hover:bg-neutral-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-[11px] text-blue-900 leading-snug">
              <strong>Вы общаетесь с ИИ-ассистентом (TIYIN AI).</strong> Ответы формируются искусственным интеллектом на базе каталога магазина и носят справочный характер (Закон РК «Об искусственном интеллекте»).
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
