"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Home,
  ShoppingBag,
  Sparkles,
  Package,
  Settings,
  Building2,
  CreditCard,
  Phone,
  Users,
  QrCode,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  LogOut,
  Lock,
  Save,
  PanelLeftOpen,
  PanelLeftClose,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  CheckCircle2,
  X,
  ImagePlus,
  Upload,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  Business,
  Product,
  ProductItemType,
  Order,
  ClientRecord,
  OrderStatus,
} from "@/lib/types";
import { formatKZT, formatDate, slugify } from "@/lib/format";
import { KZ_CITIES } from "@/lib/cities";
import { BUSINESS_CATEGORIES } from "@/lib/categories";
import { uploadBusinessMedia } from "@/lib/uploadMedia";
import {
  getBillingStatus,
  BASE_PLAN_MONTHLY_PRICE,
  BASE_PLAN_TRIAL_MONTHS,
  AI_AUTOPILOT_MONTHLY_PRICE,
} from "@/lib/subscriptionPlans";
import { BrandLogo } from "@/components/BrandLogo";
import { TiyinAiCenter } from "@/components/TiyinAiCenter";
import { TelegramMiniAppInit } from "@/components/TelegramMiniAppInit";
import { TelegramAuthButton } from "@/components/TelegramAuthButton";

type MainTab = "home" | "orders" | "ai" | "catalog" | "settings";
type SettingsSection = "menu" | "company" | "payments" | "contacts" | "clients" | "share";

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  web: { label: "Витрина", className: "bg-slate-100 text-slate-700" },
  whatsapp: { label: "WhatsApp", className: "bg-emerald-50 text-emerald-700" },
  instagram: { label: "Instagram", className: "bg-pink-50 text-pink-700" },
  telegram: { label: "Telegram", className: "bg-sky-50 text-sky-700" },
};

const ORDER_STATUS_STYLE: Record<OrderStatus, { label: string; className: string }> = {
  new: { label: "Новый", className: "bg-blue-50 text-blue-700" },
  in_progress: { label: "В работе", className: "bg-amber-50 text-amber-700" },
  done: { label: "Выполнен", className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Отменен", className: "bg-slate-100 text-slate-500" },
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string>("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [linkedTelegramId, setLinkedTelegramId] = useState<string | null>(null);
  const [linkedTelegramUsername, setLinkedTelegramUsername] = useState<string>("");

  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);

  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("menu");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>("all");
  const [addProductOpen, setAddProductOpen] = useState(false);

  const [origin, setOrigin] = useState("https://tiyin.kz");
  const [copied, setCopied] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingProdImg, setUploadingProdImg] = useState(false);

  // First-time business creation form
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createCity, setCreateCity] = useState("Алматы");
  const [createCategory, setCreateCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [createTagline, setCreateTagline] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // New product form
  const [newProdName, setNewProdName] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Основное");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdType, setNewProdType] = useState<ProductItemType>("product");
  const [newProdImageUrl, setNewProdImageUrl] = useState("");
  const [newProdGallery, setNewProdGallery] = useState<string[]>([]);

  const loadBusinessData = useCallback(async (uid: string) => {
    const supabase = getSupabaseClient();
    const { data: biz } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_id", uid)
      .maybeSingle();

    if (!biz) {
      setBusiness(null);
      setLoading(false);
      return;
    }

    const typedBiz: Business = {
      ...(biz as Business),
      city: (biz as Business).city || "Алматы",
      category: (biz as Business).category || BUSINESS_CATEGORIES[0],
      instagram: (biz as Business).instagram || "",
      cover_url: (biz as Business).cover_url || "",
      logo_url: (biz as Business).logo_url || "",
      pwa_enabled: (biz as Business).pwa_enabled ?? true,
      plan_tier: (biz as Business).plan_tier || "base",
      trial_ends_at: (biz as Business).trial_ends_at || null,
      paid_until: (biz as Business).paid_until || null,
      billing_note: (biz as Business).billing_note || "",
      kaspi_pay_link: (biz as Business).kaspi_pay_link || "",
      halyk_enabled: Boolean((biz as Business).halyk_enabled),
    };
    setBusiness(typedBiz);

    const [prodRes, ordRes, cliRes] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("business_id", typedBiz.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*")
        .eq("business_id", typedBiz.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("*")
        .eq("business_id", typedBiz.id)
        .order("last_order_at", { ascending: false }),
    ]);

    setProducts((prodRes.data as Product[]) || []);
    setOrders((ordRes.data as Order[]) || []);
    setClients((cliRes.data as ClientRecord[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
      const urlTab = new URLSearchParams(window.location.search).get("tab");
      const allowedTabs: MainTab[] = ["home", "orders", "ai", "catalog", "settings"];
      if (urlTab && allowedTabs.includes(urlTab as MainTab)) {
        setActiveTab(urlTab as MainTab);
      }
    }

    const init = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const user = session?.user;

      if (!user || !session) {
        router.replace("/auth?mode=business&tab=login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("role, telegram_id, telegram_username")
        .eq("id", user.id)
        .maybeSingle();

      if (prof?.telegram_id) {
        setLinkedTelegramId(String(prof.telegram_id));
        setLinkedTelegramUsername(String(prof.telegram_username || ""));
      }

      if (prof && prof.role === "client") {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setUserId(user.id);
      setAccessToken(session.access_token);
      await loadBusinessData(user.id);
    };

    init();
  }, [router, loadBusinessData]);

  const openSettings = (sec: SettingsSection) => {
    setActiveTab("settings");
    setSettingsSection(sec);
    setUploadError("");
  };

  const showNotice = (msg: string) => {
    setSaveNotice(msg);
    setTimeout(() => setSaveNotice(""), 3000);
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setCreateError("");
    setCreating(true);

    const finalSlug = slugify(createSlug || createName);
    const reserved = ["admin", "dashboard", "auth", "api"];
    if (!finalSlug || finalSlug.length < 2 || reserved.includes(finalSlug)) {
      setCreateError("Укажите другое название или короткую ссылку на латинице.");
      setCreating(false);
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("businesses").insert({
      owner_id: userId,
      name: createName.trim(),
      slug: finalSlug,
      city: createCity,
      category: createCategory,
      tagline: createTagline.trim(),
    });

    if (error) {
      if (error.code === "23505") {
        setCreateError("Такая короткая ссылка уже занята. Придумайте другую.");
      } else {
        setCreateError(error.message);
      }
      setCreating(false);
      return;
    }

    if (linkedTelegramId && accessToken) {
      await fetch("/api/dashboard/ai-center", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ownerTelegramChatId: linkedTelegramId,
        }),
      }).catch(() => {});
    }

    await loadBusinessData(userId);
    setCreating(false);
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("businesses")
      .update({
        name: business.name,
        city: business.city,
        category: business.category || BUSINESS_CATEGORIES[0],
        tagline: business.tagline,
        services_description: business.services_description,
        address: business.address,
        working_hours: business.working_hours,
        phone: business.phone,
        whatsapp: business.whatsapp,
        telegram: business.telegram,
        instagram: (business.instagram || "").trim(),
        cover_url: (business.cover_url || "").trim(),
        logo_url: (business.logo_url || "").trim(),
        kaspi_pay_link: (business.kaspi_pay_link || "").trim(),
        halyk_enabled: Boolean(business.halyk_enabled),
      })
      .eq("id", business.id);

    if (!error) {
      showNotice("Изменения сохранены и уже видны на витрине.");
    }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !business) return;
    setUploadError("");
    setUploadingCover(true);
    const res = await uploadBusinessMedia({
      businessId: business.id,
      folder: "covers",
      file,
    });
    setUploadingCover(false);
    e.target.value = "";

    if (res.error || !res.url) {
      setUploadError(res.error || "Ошибка загрузки обложки.");
      return;
    }

    const updated = { ...business, cover_url: res.url };
    setBusiness(updated);
    const supabase = getSupabaseClient();
    await supabase
      .from("businesses")
      .update({ cover_url: res.url })
      .eq("id", business.id);
    showNotice("Обложка витрины обновлена!");
  };

  const handleRemoveCover = async () => {
    if (!business) return;
    setBusiness({ ...business, cover_url: "" });
    const supabase = getSupabaseClient();
    await supabase.from("businesses").update({ cover_url: "" }).eq("id", business.id);
    showNotice("Установлена стандартная обложка TIYIN.");
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !business) return;
    setUploadError("");
    setUploadingLogo(true);
    const res = await uploadBusinessMedia({
      businessId: business.id,
      folder: "logos",
      file,
    });
    setUploadingLogo(false);
    e.target.value = "";

    if (res.error || !res.url) {
      setUploadError(res.error || "Ошибка загрузки логотипа.");
      return;
    }

    const updated = { ...business, logo_url: res.url };
    setBusiness(updated);
    const supabase = getSupabaseClient();
    await supabase
      .from("businesses")
      .update({ logo_url: res.url })
      .eq("id", business.id);
    showNotice("Логотип приложения обновлен!");
  };

  const handleRemoveLogo = async () => {
    if (!business) return;
    setBusiness({ ...business, logo_url: "" });
    const supabase = getSupabaseClient();
    await supabase.from("businesses").update({ logo_url: "" }).eq("id", business.id);
    showNotice("Логотип удален (будет использоваться стандартная иконка TIYIN).");
  };

  const handleUploadProductPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !business) return;
    setUploadError("");
    setUploadingProdImg(true);
    const res = await uploadBusinessMedia({
      businessId: business.id,
      folder: "products",
      file,
    });
    setUploadingProdImg(false);
    e.target.value = "";

    if (res.error || !res.url) {
      setUploadError(res.error || "Ошибка загрузки фото товара.");
      return;
    }
    setNewProdImageUrl(res.url);
  };

  const handleUploadGalleryPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !business) return;
    if (newProdGallery.length >= 4) {
      setUploadError("Можно добавить до 4 дополнительных фото.");
      return;
    }
    setUploadError("");
    setUploadingProdImg(true);
    const res = await uploadBusinessMedia({
      businessId: business.id,
      folder: "products",
      file,
    });
    setUploadingProdImg(false);
    e.target.value = "";

    if (res.error || !res.url) {
      setUploadError(res.error || "Ошибка загрузки дополнительного фото.");
      return;
    }
    setNewProdGallery((prev) => [...prev, res.url!]);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    const priceNum = parseInt(newProdPrice, 10);
    if (!newProdName.trim() || isNaN(priceNum) || priceNum < 0) return;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("products")
      .insert({
        business_id: business.id,
        name: newProdName.trim(),
        price: priceNum,
        category: newProdCategory.trim() || "Основное",
        description: newProdDesc.trim(),
        item_type: newProdType,
        image_url: newProdImageUrl.trim(),
        gallery_urls: newProdGallery,
        is_available: true,
      })
      .select()
      .single();

    if (!error && data) {
      setProducts((prev) => [data as Product, ...prev]);
      setNewProdName("");
      setNewProdPrice("");
      setNewProdDesc("");
      setNewProdImageUrl("");
      setNewProdGallery([]);
      setAddProductOpen(false);
      showNotice("Позиция добавлена в каталог.");
    }
  };

  const toggleProduct = async (prod: Product) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("products")
      .update({ is_available: !prod.is_available })
      .eq("id", prod.id);
    if (!error) {
      setProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, is_available: !p.is_available } : p))
      );
    }
  };

  const deleteProduct = async (id: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);
    if (!error) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 bg-[#F4F5F7]">
        Загрузка кабинета...
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#F4F5F7]">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
          <Lock className="w-10 h-10 text-slate-400 mx-auto" />
          <h1 className="text-xl font-bold text-neutral-950">
            Доступ только для владельцев бизнеса
          </h1>
          <p className="text-sm text-slate-500">
            Вы вошли как клиент. Чтобы создать платформу своего бизнеса, выйдите
            и зарегистрируйтесь во вкладке «Я бизнес».
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Link
              href="/"
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700"
            >
              На главную
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-medium"
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#F4F5F7]">
        <div className="max-w-lg w-full bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-5">
            <BrandLogo size="sm" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-950 mb-1">
            Запустите платформу вашего бизнеса
          </h1>
          <p className="text-sm text-slate-500 mb-4">
            Укажите название, сферу деятельности и город — ваша витрина, QR-код и
            брендированное приложение создадутся сразу.
          </p>

          <div className="mb-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3.5 text-xs text-emerald-950 space-y-1">
            <div className="font-bold text-emerald-900">
              {BASE_PLAN_TRIAL_MONTHS} месяцев бесплатно · далее {formatKZT(BASE_PLAN_MONTHLY_PRICE)}/мес · 0% с продаж
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Мы не берем процент с ваших продаж. Приложение на главный экран телефона с
              вашим логотипом доступно клиентам сразу.
            </p>
          </div>

          <form onSubmit={handleCreateBusiness} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Название компании
              </label>
              <input
                type="text"
                value={createName}
                onChange={(e) => {
                  setCreateName(e.target.value);
                  setCreateSlug(slugify(e.target.value));
                }}
                placeholder="Например: Ameli Shop"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Сфера деятельности
                </label>
                <select
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Город (Казахстан)
                </label>
                <select
                  value={createCity}
                  onChange={(e) => setCreateCity(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  {KZ_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Короткий адрес вашей витрины (на латинице)
              </label>
              <div className="flex items-center rounded-xl border border-slate-300 overflow-hidden bg-slate-50">
                <span className="px-3 text-xs text-slate-500 truncate max-w-[160px]">
                  {origin.replace(/^https?:\/\//, "")}/
                </span>
                <input
                  type="text"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(slugify(e.target.value))}
                  placeholder="ameli-shop"
                  className="flex-1 px-3 py-3 bg-white text-sm focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Кратко о ваших услугах
              </label>
              <input
                type="text"
                value={createTagline}
                onChange={(e) => setCreateTagline(e.target.value)}
                placeholder="Авторские букеты, стоматология, автосервис..."
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            {createError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                {createError}
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-sm transition"
            >
              {creating ? "Создаем..." : "Создать кабинет и витрину"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const publicUrl = `${origin}/${business.slug}`;
  const billingInfo = getBillingStatus(business);
  const formattedActiveUntil = billingInfo.activeUntil.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const activeOrders = orders.filter(
    (o) => o.status === "new" || o.status === "in_progress"
  );
  const newOrdersCount = orders.filter((o) => o.status === "new").length;
  const completedRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.total_price || 0), 0);

  const filteredOrders =
    orderSourceFilter === "all"
      ? orders
      : orders.filter((o) => (o.source || "web") === orderSourceFilter);

  const hasPaymentConfigured =
    Boolean(business.kaspi_pay_link?.trim()) || Boolean(business.halyk_enabled);
  const hasContactsConfigured = Boolean(
    business.phone?.trim() ||
      business.whatsapp?.trim() ||
      business.telegram?.trim() ||
      business.instagram?.trim()
  );

  const navItems: {
    id: MainTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { id: "home", label: "Главная", icon: <Home className="w-5 h-5" /> },
    {
      id: "orders",
      label: "Заказы",
      icon: <ShoppingBag className="w-5 h-5" />,
      badge: newOrdersCount > 0 ? newOrdersCount : undefined,
    },
    { id: "ai", label: "TIYIN AI", icon: <Sparkles className="w-5 h-5" /> },
    { id: "catalog", label: "Каталог", icon: <Package className="w-5 h-5" /> },
    { id: "settings", label: "Настройки", icon: <Settings className="w-5 h-5" /> },
  ];

  const handleSelectMainTab = (tab: MainTab) => {
    setActiveTab(tab);
    setUploadError("");
    if (tab === "settings") {
      setSettingsSection("menu");
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col md:flex-row">
      <TelegramMiniAppInit />
      {/* DESKTOP COLLAPSIBLE ICON-RAIL SIDEBAR */}
      <aside
        className={`hidden md:flex md:flex-col bg-white border-r border-slate-200/90 sticky top-0 h-screen justify-between shrink-0 transition-all duration-200 ${
          sidebarExpanded ? "w-64" : "w-20"
        }`}
      >
        <div className="p-3">
          <div
            className={`flex items-center mb-6 px-1 pt-1 ${
              sidebarExpanded ? "justify-between" : "flex-col gap-3"
            }`}
          >
            <Link href="/" title="На главную TIYIN Space">
              {sidebarExpanded ? (
                <BrandLogo size="sm" />
              ) : (
                <span className="w-10 h-10 rounded-xl bg-neutral-950 text-white text-xs font-extrabold flex items-center justify-center shadow-sm">
                  T.S
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setSidebarExpanded((prev) => !prev)}
              className="p-2 rounded-xl text-slate-500 hover:text-neutral-950 hover:bg-slate-100 transition"
              title={sidebarExpanded ? "Свернуть меню" : "Развернуть меню"}
            >
              {sidebarExpanded ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeftOpen className="w-5 h-5" />
              )}
            </button>
          </div>

          {sidebarExpanded && (
            <div className="mb-5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="font-bold text-sm text-neutral-950 truncate">
                {business.name}
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                {business.city} • {business.category}
              </div>
            </div>
          )}

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectMainTab(item.id)}
                  title={!sidebarExpanded ? item.label : undefined}
                  className={`relative w-full flex items-center rounded-2xl transition font-semibold text-sm ${
                    sidebarExpanded
                      ? "justify-between px-3.5 py-3"
                      : "justify-center py-3"
                  } ${
                    active
                      ? "bg-neutral-950 text-white shadow-sm"
                      : item.id === "ai"
                      ? "text-blue-600 bg-blue-50/70 hover:bg-blue-100/70"
                      : "text-slate-600 hover:bg-slate-100 hover:text-neutral-950"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {item.icon}
                    {sidebarExpanded && <span>{item.label}</span>}
                  </span>

                  {item.badge && sidebarExpanded && (
                    <span className="px-2 py-0.5 text-[11px] rounded-full bg-red-500 text-white">
                      {item.badge}
                    </span>
                  )}
                  {item.badge && !sidebarExpanded && (
                    <span className="absolute top-1.5 right-2.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-slate-100 space-y-1.5">
          <Link
            href={`/${business.slug}`}
            target="_blank"
            title={!sidebarExpanded ? "Открыть витрину" : undefined}
            className={`w-full flex items-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-neutral-900 text-sm font-medium transition ${
              sidebarExpanded ? "justify-center gap-2 px-3 py-2.5" : "justify-center py-2.5"
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            {sidebarExpanded && <span>Витрина</span>}
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            title={!sidebarExpanded ? "Выйти" : undefined}
            className={`w-full flex items-center rounded-2xl text-slate-500 hover:bg-slate-100 text-xs font-medium transition ${
              sidebarExpanded ? "justify-center gap-2 px-3 py-2.5" : "justify-center py-2.5"
            }`}
          >
            <LogOut className="w-4 h-4" />
            {sidebarExpanded && <span>Выйти</span>}
          </button>
        </div>
      </aside>

      {/* MOBILE TOP APP BAR */}
      <header className="md:hidden bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 h-14 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/"
            className="w-8 h-8 rounded-xl bg-neutral-950 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0"
          >
            T.S
          </Link>
          <div className="min-w-0">
            <div className="font-bold text-sm text-neutral-950 truncate leading-tight">
              {business.name}
            </div>
            <div className="text-[11px] text-slate-400 truncate leading-tight">
              {business.city}
            </div>
          </div>
        </div>

        <Link
          href={`/${business.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-neutral-900 text-xs font-semibold shrink-0"
        >
          <span>Витрина</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-5 pb-28 md:py-8 md:px-8">
        {saveNotice && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-2xl flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveNotice}</span>
          </div>
        )}

        {uploadError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl shadow-sm">
            {uploadError}
          </div>
        )}

        {/* TAB 1: HOME */}
        {activeTab === "home" && (
          <div className="space-y-5">
            {(billingInfo.status === "expiring_soon" ||
              billingInfo.status === "grace" ||
              billingInfo.status === "overdue") && (
              <div
                className={`rounded-3xl p-4 sm:p-5 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  billingInfo.status === "overdue"
                    ? "bg-red-50 border-red-200 text-red-950"
                    : "bg-amber-50 border-amber-200 text-amber-950"
                }`}
              >
                <div className="space-y-1">
                  <div className="font-bold text-sm">
                    {billingInfo.status === "expiring_soon"
                      ? `Бесплатный период заканчивается ${formattedActiveUntil} (осталось ${Math.max(
                          0,
                          billingInfo.daysLeft
                        )} дн.)`
                      : `Срок действия тарифа истек ${formattedActiveUntil}`}
                  </div>
                  <p className="text-xs opacity-85">
                    Продлите кабинет за {formatKZT(BASE_PLAN_MONTHLY_PRICE)}/мес (или
                    выгодно сразу за год) — мы по-прежнему берем 0% комиссии с ваших продаж.
                  </p>
                </div>
                <a
                  href="https://t.me/tiyinkz"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-xs font-semibold shrink-0 hover:bg-neutral-800 transition"
                >
                  Продлить в Telegram
                </a>
              </div>
            )}
            <div className="bg-neutral-950 text-white rounded-3xl p-5 sm:p-6 shadow-md space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-neutral-400">Выручка по заказам</div>
                  <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1">
                    {formatKZT(completedRevenue)}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Онлайн
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("orders")}
                  className="text-left bg-white/[0.07] hover:bg-white/[0.11] border border-white/10 rounded-2xl p-3 transition"
                >
                  <div className="text-[11px] text-neutral-400">В работе</div>
                  <div className="text-lg font-bold mt-0.5 flex items-center gap-1.5">
                    {activeOrders.length}
                    {newOrdersCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500 text-white font-semibold">
                        +{newOrdersCount}
                      </span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => openSettings("clients")}
                  className="text-left bg-white/[0.07] hover:bg-white/[0.11] border border-white/10 rounded-2xl p-3 transition"
                >
                  <div className="text-[11px] text-neutral-400">Клиентов</div>
                  <div className="text-lg font-bold mt-0.5">{clients.length}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("catalog")}
                  className="text-left bg-white/[0.07] hover:bg-white/[0.11] border border-white/10 rounded-2xl p-3 transition"
                >
                  <div className="text-[11px] text-neutral-400">Позиций</div>
                  <div className="text-lg font-bold mt-0.5">{products.length}</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("catalog");
                  setAddProductOpen(true);
                }}
                className="bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center gap-2 text-center shadow-sm transition"
              >
                <span className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-950 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-neutral-800 leading-tight">
                  + Товар
                </span>
              </button>

              <button
                type="button"
                onClick={() => openSettings("share")}
                className="bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center gap-2 text-center shadow-sm transition"
              >
                <span className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-950 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-neutral-800 leading-tight">
                  Мой QR
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className="bg-white hover:bg-blue-50/40 border border-blue-200/70 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center gap-2 text-center shadow-sm transition"
              >
                <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-neutral-900 leading-tight">
                  TIYIN AI
                </span>
              </button>

              <button
                type="button"
                onClick={() => openSettings("payments")}
                className="bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center gap-2 text-center shadow-sm transition"
              >
                <span className="w-10 h-10 rounded-xl bg-red-50 text-[#F14635] flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-neutral-800 leading-tight">
                  Оплата
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className="w-full text-left bg-white hover:border-neutral-900 border border-slate-200/90 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-3 shadow-sm transition"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-11 h-11 rounded-2xl bg-neutral-950 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-sm sm:text-base text-neutral-950">
                    Центр TIYIN AI — автопилот продаж
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    Диалоги клиентов, пауза ИИ, Telegram-уведомления и подключение каналов
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </button>

            {(products.length === 0 || !hasPaymentConfigured || !hasContactsConfigured) && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Быстрый запуск витрины
                </div>
                <div className="space-y-2">
                  {products.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("catalog");
                        setAddProductOpen(true);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition text-left"
                    >
                      <span className="text-sm font-medium text-neutral-900">
                        Добавьте первые товары или услуги с фото
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                  {!hasPaymentConfigured && (
                    <button
                      type="button"
                      onClick={() => openSettings("payments")}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition text-left"
                    >
                      <span className="text-sm font-medium text-neutral-900">
                        Подключите Kaspi Pay или Halyk Bank
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                  {!hasContactsConfigured && (
                    <button
                      type="button"
                      onClick={() => openSettings("contacts")}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition text-left"
                    >
                      <span className="text-sm font-medium text-neutral-900">
                        Укажите Instagram, WhatsApp или телефон
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-base text-neutral-950">Последние заказы</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab("orders")}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Все заказы ({orders.length})
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <p className="text-sm text-slate-500">
                    Заказов пока нет — поделитесь ссылкой или QR-кодом витрины с клиентами.
                  </p>
                  <button
                    type="button"
                    onClick={() => openSettings("share")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-950 text-white text-xs font-semibold"
                  >
                    <QrCode className="w-4 h-4" />
                    Открыть ссылку и QR
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {orders.slice(0, 5).map((ord) => {
                    const src = SOURCE_LABELS[ord.source || "web"] || SOURCE_LABELS.web;
                    const st = ORDER_STATUS_STYLE[ord.status] || ORDER_STATUS_STYLE.new;
                    return (
                      <div
                        key={ord.id}
                        className="px-5 py-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-sm text-neutral-950">
                              {ord.order_code}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${src.className}`}
                            >
                              {src.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${st.className}`}
                            >
                              {st.label}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            {ord.client_name} • {ord.client_phone}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-bold text-sm text-neutral-950">
                            {formatKZT(ord.total_price)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatDate(ord.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-neutral-950">Заказы</h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Все заявки с витрины, WhatsApp, Instagram и Telegram
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "Все" },
                  { id: "web", label: "Витрина" },
                  { id: "whatsapp", label: "WhatsApp" },
                  { id: "instagram", label: "Instagram" },
                  { id: "telegram", label: "Telegram" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrderSourceFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      orderSourceFilter === f.id
                        ? "bg-neutral-950 text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-sm text-slate-500 shadow-sm">
                Заказов в этом разделе пока нет.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((ord) => {
                  const src = SOURCE_LABELS[ord.source || "web"] || SOURCE_LABELS.web;
                  return (
                    <div
                      key={ord.id}
                      className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-neutral-950">{ord.order_code}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${src.className}`}
                          >
                            {src.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDate(ord.created_at)}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-neutral-800">
                          {ord.client_name} • {ord.client_phone}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>Оплата: {ord.payment_method || "Уточнить"}</span>
                          {ord.delivery_method && (
                            <span>• Получение: {ord.delivery_method}</span>
                          )}
                        </div>
                        {ord.comment && (
                          <div className="text-xs text-slate-500">
                            Комментарий / адрес: {ord.comment}
                          </div>
                        )}
                        <div className="text-sm text-slate-700 pt-1">
                          {Array.isArray(ord.items)
                            ? ord.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")
                            : ""}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-lg font-extrabold text-neutral-950">
                          {formatKZT(ord.total_price)}
                        </div>
                        <select
                          value={ord.status}
                          onChange={(e) =>
                            updateOrderStatus(ord.id, e.target.value as OrderStatus)
                          }
                          className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                        >
                          <option value="new">Новый</option>
                          <option value="in_progress">В работе</option>
                          <option value="done">Выполнен</option>
                          <option value="cancelled">Отменен</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TIYIN AI */}
        {activeTab === "ai" && (
          <TiyinAiCenter
            accessToken={accessToken}
            business={business}
            orders={orders}
          />
        )}

        {/* TAB 4: CATALOG (WITH PHOTO UPLOAD & PRODUCT/SERVICE TOGGLE) */}
        {activeTab === "catalog" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-neutral-950">Каталог</h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Позиций на витрине: {products.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddProductOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold transition shadow-sm"
              >
                {addProductOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{addProductOpen ? "Скрыть" : "Добавить"}</span>
              </button>
            </div>

            {addProductOpen && (
              <form
                onSubmit={handleAddProduct}
                className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4"
              >
                <div className="font-bold text-sm text-neutral-950">
                  Новый товар или услуга
                </div>

                {/* Toggle Product vs Service */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setNewProdType("product")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition ${
                      newProdType === "product"
                        ? "bg-white text-neutral-950 shadow-sm"
                        : "text-slate-500"
                    }`}
                  >
                    Товар (кнопка «Купить»)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProdType("service")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition ${
                      newProdType === "service"
                        ? "bg-white text-neutral-950 shadow-sm"
                        : "text-slate-500"
                    }`}
                  >
                    Услуга (кнопка «Заказать»)
                  </button>
                </div>

                {/* Photo upload */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {newProdImageUrl ? (
                      <img
                        src={newProdImageUrl}
                        alt="Превью"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImagePlus className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-900 text-xs font-semibold cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingProdImg
                          ? "Загружаем фото..."
                          : newProdImageUrl
                          ? "Заменить фото"
                          : "Загрузить фото с устройства"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadProductPhoto}
                        disabled={uploadingProdImg}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Основное фото (JPG, PNG, WebP до 5 МБ).
                    </p>
                  </div>
                </div>

                {/* Extra gallery photos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">
                      Дополнительные фото ({newProdGallery.length}/4)
                    </span>
                    {newProdGallery.length < 4 && (
                      <label className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">
                        + Добавить фото
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadGalleryPhoto}
                          disabled={uploadingProdImg}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  {newProdGallery.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {newProdGallery.map((url, idx) => (
                        <div
                          key={url + idx}
                          className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200"
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() =>
                              setNewProdGallery((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Название (напр. Пицца Пепперони)"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Цена в ₸"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Раздел каталога (напр. Пицца)"
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Краткое описание (необязательно)"
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
                <button
                  type="submit"
                  disabled={uploadingProdImg}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-sm font-semibold transition"
                >
                  <Plus className="w-4 h-4" />
                  Сохранить в каталог
                </button>
              </form>
            )}

            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {products.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 space-y-3">
                  <p>В каталоге пока пусто.</p>
                  <button
                    type="button"
                    onClick={() => setAddProductOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-950 text-white text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить первую позицию
                  </button>
                </div>
              ) : (
                products.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-neutral-950 truncate">
                            {prod.name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {prod.category}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
                            {prod.item_type === "service" ? "Услуга" : "Товар"}
                          </span>
                        </div>
                        {prod.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {prod.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className="font-bold text-neutral-950">
                        {formatKZT(prod.price)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleProduct(prod)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-semibold ${
                            prod.is_available
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {prod.is_available ? "В наличии" : "Скрыто"}
                        </button>
                        <button
                          onClick={() => deleteProduct(prod.id)}
                          className="p-2 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            {settingsSection === "menu" && (
              <>
                <div>
                  <h1 className="text-2xl font-bold text-neutral-950">
                    Управление и настройки
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500">
                    {business.name} • {business.city}
                  </p>
                </div>

                {/* Billing & Subscription Status Card */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Ваш тариф
                      </div>
                      <div className="font-bold text-base text-neutral-950 mt-0.5">
                        {business.plan_tier === "ai_autopilot"
                          ? `TIYIN AI Автопилот (${formatKZT(AI_AUTOPILOT_MONTHLY_PRICE)}/мес)`
                          : `Базовый кабинет (0% с продаж)`}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        billingInfo.status === "overdue"
                          ? "bg-red-50 text-red-700"
                          : billingInfo.status === "grace" ||
                            billingInfo.status === "expiring_soon"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {billingInfo.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-slate-400">Пользуетесь</div>
                      <div className="font-bold text-neutral-950 mt-0.5">
                        {billingInfo.daysUsed} дн.
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-slate-400">
                        {billingInfo.isPaid ? "Оплачено до" : "Бесплатно до"}
                      </div>
                      <div className="font-bold text-neutral-950 mt-0.5">
                        {formattedActiveUntil}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 col-span-2 sm:col-span-1">
                      <div className="text-slate-400">Осталось</div>
                      <div className="font-bold text-neutral-950 mt-0.5">
                        {billingInfo.daysLeft >= 0
                          ? `${billingInfo.daysLeft} дн.`
                          : `Просрочено ${Math.abs(billingInfo.daysLeft)} дн.`}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
                    <span>
                      После 6 мес: <strong>{formatKZT(BASE_PLAN_MONTHLY_PRICE)}/мес</strong>{" "}
                      • Приложение (PWA) включено сразу
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("ai")}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      Подключить TIYIN AI →
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm divide-y divide-slate-100 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSettingsSection("company")}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="w-10 h-10 rounded-2xl bg-slate-100 text-neutral-900 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-neutral-950">
                          О компании, логотип и обложка витрины
                        </div>
                        <div className="text-xs text-slate-500">
                          {business.category} •{" "}
                          {business.cover_url ? "Своя обложка" : "Стандартная обложка"}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsSection("contacts")}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-neutral-950">
                          Соцсети и контакты (Instagram, WhatsApp, Telegram)
                        </div>
                        <div className="text-xs text-slate-500">
                          {[business.instagram, business.whatsapp, business.phone]
                            .filter(Boolean)
                            .join(" • ") || "Не заполнены"}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsSection("payments")}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="w-10 h-10 rounded-2xl bg-red-50 text-[#F14635] flex items-center justify-center shrink-0">
                        <CreditCard className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-neutral-950">
                          Подключение оплаты (Kaspi / Halyk)
                        </div>
                        <div className="text-xs text-slate-500">
                          {hasPaymentConfigured
                            ? [
                                business.kaspi_pay_link?.trim() ? "Kaspi Pay" : "",
                                business.halyk_enabled ? "Halyk" : "",
                              ]
                                .filter(Boolean)
                                .join(" • ")
                            : "Пока не подключено"}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsSection("clients")}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-neutral-950">
                          База клиентов
                        </div>
                        <div className="text-xs text-slate-500">
                          Всего в базе: {clients.length}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsSection("share")}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="w-10 h-10 rounded-2xl bg-neutral-950 text-white flex items-center justify-center shrink-0">
                        <QrCode className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-neutral-950">
                          Ссылка и QR-код витрины
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          /{business.slug}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </button>
                </div>

                {/* Telegram Auth Link Card */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm text-neutral-950">
                        Вход через Telegram
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {linkedTelegramId
                          ? `Привязан: ${
                              linkedTelegramUsername
                                ? `@${linkedTelegramUsername}`
                                : `ID ${linkedTelegramId}`
                            } · уведомления подключены`
                          : "Привяжите Telegram, чтобы входить в 1 клик и получать заказы автоматически"}
                      </div>
                    </div>
                    {linkedTelegramId && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold shrink-0">
                        Привязан
                      </span>
                    )}
                  </div>

                  {!linkedTelegramId && (
                    <div className="pt-1">
                      <TelegramAuthButton
                        action="link"
                        accessToken={accessToken}
                        label="Привязать Telegram к кабинету"
                        onSuccess={(res) => {
                          if (res.telegram_id) {
                            setLinkedTelegramId(res.telegram_id);
                            setLinkedTelegramUsername(res.telegram_username || "");
                            showNotice(
                              "Telegram привязан! Теперь можно входить в 1 клик, а заказы будут приходить в ваш Telegram."
                            );
                          }
                        }}
                        onError={(msg) => setUploadError(msg)}
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-3.5 rounded-2xl bg-white border border-slate-200 text-red-600 hover:bg-red-50 text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <LogOut className="w-4 h-4" />
                  Выйти из кабинета
                </button>
              </>
            )}

            {settingsSection !== "menu" && (
              <button
                type="button"
                onClick={() => setSettingsSection("menu")}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-neutral-950"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад в настройки
              </button>
            )}

            {/* SUB-SECTION: COMPANY & COVER IMAGE */}
            {settingsSection === "company" && (
              <form onSubmit={handleSaveBusiness} className="space-y-4 max-w-2xl">
                <h1 className="text-2xl font-bold text-neutral-950">
                  О компании и обложка
                </h1>

                {/* Cover Upload Card */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
                  <div className="font-semibold text-sm text-neutral-950">
                    Обложка вашей витрины
                  </div>
                  <div
                    className="relative h-36 rounded-2xl overflow-hidden border border-slate-200 flex items-end p-4"
                    style={
                      business.cover_url
                        ? {
                            backgroundImage: `url(${business.cover_url})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : {
                            background:
                              "radial-gradient(circle at 80% 20%, #2b3448 0%, #111318 65%, #090a0d 100%)",
                          }
                    }
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="relative z-10 text-white">
                      <div className="font-bold text-lg leading-tight">{business.name}</div>
                      <div className="text-xs text-white/75">{business.category}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingCover ? "Загружаем..." : "Загрузить свою обложку"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadCover}
                        disabled={uploadingCover}
                        className="hidden"
                      />
                    </label>

                    {business.cover_url && (
                      <button
                        type="button"
                        onClick={handleRemoveCover}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Вернуть стандартную
                      </button>
                    )}
                  </div>
                </div>

                {/* Logo Upload Card (PWA App Icon) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm text-neutral-950">
                        Логотип (иконка приложения)
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Квадратное изображение (рекомендуем 512×512 px, PNG или JPG до 5 МБ).
                        Отображается на главном экране телефона клиента при установке вашей витрины.
                      </p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                      {business.logo_url ? (
                        <img
                          src={business.logo_url}
                          alt="Логотип бизнеса"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImagePlus className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingLogo
                          ? "Загружаем..."
                          : business.logo_url
                          ? "Заменить логотип"
                          : "Загрузить логотип"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadLogo}
                        disabled={uploadingLogo}
                        className="hidden"
                      />
                    </label>

                    {business.logo_url && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Удалить логотип
                      </button>
                    )}
                  </div>
                </div>

                {/* Text Profile Fields */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Название компании
                      </label>
                      <input
                        type="text"
                        value={business.name}
                        onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Сфера деятельности
                      </label>
                      <select
                        value={business.category || BUSINESS_CATEGORIES[0]}
                        onChange={(e) =>
                          setBusiness({ ...business, category: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                      >
                        {BUSINESS_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Город
                      </label>
                      <select
                        value={business.city || "Алматы"}
                        onChange={(e) => setBusiness({ ...business, city: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                      >
                        {KZ_CITIES.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Краткий слоган
                      </label>
                      <input
                        type="text"
                        value={business.tagline}
                        onChange={(e) =>
                          setBusiness({ ...business, tagline: e.target.value })
                        }
                        placeholder="Авторские букеты с доставкой"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Подробное описание услуг
                    </label>
                    <textarea
                      rows={3}
                      value={business.services_description}
                      onChange={(e) =>
                        setBusiness({ ...business, services_description: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Адрес
                      </label>
                      <input
                        type="text"
                        value={business.address}
                        onChange={(e) =>
                          setBusiness({ ...business, address: e.target.value })
                        }
                        placeholder="ул. Абая 50"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        График работы
                      </label>
                      <input
                        type="text"
                        value={business.working_hours}
                        onChange={(e) =>
                          setBusiness({ ...business, working_hours: e.target.value })
                        }
                        placeholder="Ежедневно 09:00 – 21:00"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition"
                  >
                    <Save className="w-4 h-4" />
                    Сохранить изменения
                  </button>
                </div>
              </form>
            )}

            {/* SUB-SECTION: CONTACTS & SOCIALS */}
            {settingsSection === "contacts" && (
              <form onSubmit={handleSaveBusiness} className="space-y-4 max-w-xl">
                <h1 className="text-2xl font-bold text-neutral-950">Соцсети и контакты</h1>
                <p className="text-xs text-slate-500">
                  Заполненные поля автоматически появятся красивыми кнопками под обложкой
                  вашей витрины.
                </p>
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Instagram (ник или ссылка)
                    </label>
                    <input
                      type="text"
                      value={business.instagram || ""}
                      onChange={(e) =>
                        setBusiness({ ...business, instagram: e.target.value })
                      }
                      placeholder="@maks_auto_kz или https://instagram.com/..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      WhatsApp (номер телефона)
                    </label>
                    <input
                      type="tel"
                      value={business.whatsapp}
                      onChange={(e) => setBusiness({ ...business, whatsapp: e.target.value })}
                      placeholder="+7 707 123 45 67"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Telegram (логин или ссылка)
                    </label>
                    <input
                      type="text"
                      value={business.telegram}
                      onChange={(e) => setBusiness({ ...business, telegram: e.target.value })}
                      placeholder="@my_business"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Телефон для звонков
                    </label>
                    <input
                      type="tel"
                      value={business.phone}
                      onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                      placeholder="+7 707 123 45 67"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition"
                  >
                    <Save className="w-4 h-4" />
                    Сохранить контакты
                  </button>
                </div>
              </form>
            )}

            {/* SUB-SECTION: PAYMENTS */}
            {settingsSection === "payments" && (
              <form onSubmit={handleSaveBusiness} className="space-y-4 max-w-2xl">
                <h1 className="text-2xl font-bold text-neutral-950">Подключение оплаты</h1>

                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-[#F14635] text-white font-extrabold text-sm flex items-center justify-center">
                        K
                      </span>
                      <div>
                        <div className="font-bold text-neutral-950">Kaspi Pay (ссылка QR)</div>
                        <div className="text-xs text-slate-500">
                          Появится как способ оплаты при оформлении в корзине
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        business.kaspi_pay_link?.trim()
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {business.kaspi_pay_link?.trim() ? "Активен" : "Выкл"}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Ссылка на ваш Kaspi Pay QR
                    </label>
                    <input
                      type="url"
                      value={business.kaspi_pay_link || ""}
                      onChange={(e) =>
                        setBusiness({ ...business, kaspi_pay_link: e.target.value })
                      }
                      placeholder="https://pay.kaspi.kz/pay/..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-[#00805F] text-white font-extrabold text-sm flex items-center justify-center">
                        H
                      </span>
                      <div>
                        <div className="font-bold text-neutral-950">Halyk Bank / ePay</div>
                        <div className="text-xs text-slate-500">
                          Отображать в списке способов оплаты в корзине
                        </div>
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(business.halyk_enabled)}
                        onChange={(e) =>
                          setBusiness({ ...business, halyk_enabled: e.target.checked })
                        }
                        className="w-5 h-5 rounded border-slate-300 accent-neutral-950"
                      />
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition"
                >
                  <Save className="w-4 h-4" />
                  Сохранить способы оплаты
                </button>
              </form>
            )}

            {/* SUB-SECTION: CLIENTS */}
            {settingsSection === "clients" && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold text-neutral-950">База клиентов</h1>
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Клиент</th>
                        <th className="px-5 py-3">Телефон</th>
                        <th className="px-5 py-3">Заказов</th>
                        <th className="px-5 py-3">Сумма</th>
                        <th className="px-5 py-3">Последний заказ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clients.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                            База клиентов пока пуста.
                          </td>
                        </tr>
                      ) : (
                        clients.map((c) => (
                          <tr key={c.id}>
                            <td className="px-5 py-3.5 font-medium text-neutral-950">
                              {c.name}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">{c.phone}</td>
                            <td className="px-5 py-3.5 text-slate-600">{c.orders_count}</td>
                            <td className="px-5 py-3.5 font-semibold text-neutral-950">
                              {formatKZT(c.total_spent)}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-slate-500">
                              {formatDate(c.last_order_at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-SECTION: SHARE & QR */}
            {settingsSection === "share" && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold text-neutral-950">
                  Ссылка и QR-код витрины
                </h1>
                <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center gap-8">
                  <div className="p-4 bg-white rounded-2xl border-2 border-neutral-950">
                    <QRCodeSVG value={publicUrl} size={180} />
                  </div>
                  <div className="flex-1 space-y-4 w-full">
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1.5">
                        Прямая ссылка на витрину
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={publicUrl}
                          className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(publicUrl);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-medium hover:bg-neutral-800"
                        >
                          {copied ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          {copied ? "Скопировано" : "Копировать"}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Распечатать QR-код
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-30">
        <div className="grid grid-cols-5 gap-1 max-w-md mx-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectMainTab(item.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
                  active
                    ? "text-neutral-950"
                    : item.id === "ai"
                    ? "text-blue-600"
                    : "text-slate-400"
                }`}
              >
                <span
                  className={`p-1.5 rounded-xl transition ${
                    active
                      ? "bg-neutral-950 text-white"
                      : item.id === "ai"
                      ? "bg-blue-50 text-blue-600"
                      : ""
                  }`}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] font-semibold mt-0.5 leading-none">
                  {item.label}
                </span>
                {item.badge && (
                  <span className="absolute top-1 right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
