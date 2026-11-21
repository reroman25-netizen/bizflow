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
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Business, Product, Order, ClientRecord, OrderStatus } from "@/lib/types";
import { formatKZT, formatDate, slugify } from "@/lib/format";
import { KZ_CITIES } from "@/lib/cities";
import { BUSINESS_CATEGORIES } from "@/lib/categories";
import { BrandLogo } from "@/components/BrandLogo";
import { TiyinAiCenter } from "@/components/TiyinAiCenter";

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

  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);

  // Navigation state (Slide 2: Home screen by default + collapsible desktop rail + mobile bottom bar)
  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("menu");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>("all");
  const [addProductOpen, setAddProductOpen] = useState(false);

  const [origin, setOrigin] = useState("https://tiyin.kz");
  const [copied, setCopied] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");

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
  const [newProdCategory, setNewProdCategory] = useState("Услуги");
  const [newProdDesc, setNewProdDesc] = useState("");

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
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

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
        kaspi_pay_link: (business.kaspi_pay_link || "").trim(),
        halyk_enabled: Boolean(business.halyk_enabled),
      })
      .eq("id", business.id);

    if (!error) {
      setSaveNotice("Изменения сохранены и уже видны на витрине.");
      setTimeout(() => setSaveNotice(""), 3000);
    }
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
        category: newProdCategory.trim() || "Услуги",
        description: newProdDesc.trim(),
        is_available: true,
      })
      .select()
      .single();

    if (!error && data) {
      setProducts((prev) => [data as Product, ...prev]);
      setNewProdName("");
      setNewProdPrice("");
      setNewProdDesc("");
      setAddProductOpen(false);
      setSaveNotice("Позиция добавлена в каталог.");
      setTimeout(() => setSaveNotice(""), 2500);
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

  // Первый вход — запуск бизнеса
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
          <p className="text-sm text-slate-500 mb-6">
            Укажите название, сферу деятельности и город — ваша витрина и QR-код
            создадутся сразу.
          </p>

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
    business.phone?.trim() || business.whatsapp?.trim() || business.telegram?.trim()
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
    if (tab === "settings") {
      setSettingsSection("menu");
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col md:flex-row">
      {/* DESKTOP COLLAPSIBLE ICON-RAIL SIDEBAR */}
      <aside
        className={`hidden md:flex md:flex-col bg-white border-r border-slate-200/90 sticky top-0 h-screen justify-between shrink-0 transition-all duration-200 ${
          sidebarExpanded ? "w-64" : "w-20"
        }`}
      >
        <div className="p-3">
          {/* Top Brand + Collapse/Expand Toggle */}
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

          {/* Company Mini Badge when expanded */}
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

          {/* Main 5 Navigation Items */}
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

        {/* Bottom Actions */}
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

      {/* MOBILE TOP APP BAR (Kaspi Pay style) */}
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

        {/* ============================================================
            TAB 1: HOME (SLIDE 2 — KASPI PAY STYLE MAIN SCREEN)
           ============================================================ */}
        {activeTab === "home" && (
          <div className="space-y-5">
            {/* Dark Balance / Revenue Card */}
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

            {/* 4 Quick Action Tiles (Kaspi Pay style) */}
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

            {/* TIYIN AI Quick Promo / Status Strip */}
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

            {/* Quick Setup Checklist (only shown if something is still missing) */}
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
                        Добавьте первые товары или услуги
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
                        Укажите телефон, WhatsApp или Telegram
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Live Operations: Recent Orders */}
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

        {/* ============================================================
            TAB 2: ORDERS (UNIFIED FEED)
           ============================================================ */}
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

        {/* ============================================================
            TAB 3: TIYIN AI (SLIDE 4 DESIGN)
           ============================================================ */}
        {activeTab === "ai" && (
          <TiyinAiCenter
            accessToken={accessToken}
            business={business}
            orders={orders}
          />
        )}

        {/* ============================================================
            TAB 4: CATALOG
           ============================================================ */}
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
                className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3"
              >
                <div className="font-bold text-sm text-neutral-950">
                  Новый товар или услуга
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Название"
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
                    placeholder="Категория (например: Букеты)"
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
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-semibold transition"
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
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-neutral-950">{prod.name}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {prod.category}
                        </span>
                      </div>
                      {prod.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{prod.description}</p>
                      )}
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

        {/* ============================================================
            TAB 5: SETTINGS (CLEAN KASPI-STYLE GROUPED MENU)
           ============================================================ */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            {settingsSection === "menu" && (
              <>
                <div>
                  <h1 className="text-2xl font-bold text-neutral-950">Управление и настройки</h1>
                  <p className="text-xs sm:text-sm text-slate-500">
                    {business.name} • {business.city}
                  </p>
                </div>

                {/* Grouped Menu List */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm divide-y divide-slate-100 overflow-hidden">
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
                    onClick={() => setSettingsSection("company")}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="w-10 h-10 rounded-2xl bg-slate-100 text-neutral-900 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-neutral-950">
                          О компании и график работы
                        </div>
                        <div className="text-xs text-slate-500">
                          {business.category} • {business.city}
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
                          Контакты (Телефон, WhatsApp, Telegram)
                        </div>
                        <div className="text-xs text-slate-500">
                          {business.whatsapp || business.phone || "Не заполнены"}
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

                {/* Logout Button */}
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

            {/* Back button for any settings sub-section */}
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
                          Значок Kaspi появится в шапке витрины и в корзине
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
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Kaspi Pay → «Мой QR» → «Поделиться ссылкой». Оставьте пустым, чтобы
                      скрыть значок Kaspi.
                    </p>
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
                          Отображать значок Halyk на витрине (API ePay скоро)
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

            {/* SUB-SECTION: COMPANY */}
            {settingsSection === "company" && (
              <form onSubmit={handleSaveBusiness} className="space-y-4 max-w-2xl">
                <h1 className="text-2xl font-bold text-neutral-950">О компании и услугах</h1>
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
                      rows={4}
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

            {/* SUB-SECTION: CONTACTS */}
            {settingsSection === "contacts" && (
              <form onSubmit={handleSaveBusiness} className="space-y-4 max-w-xl">
                <h1 className="text-2xl font-bold text-neutral-950">Контакты для клиентов</h1>
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
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

      {/* MOBILE BOTTOM NAVIGATION BAR (SLIDE 2 KASPI PAY STYLE) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 px-2 pt-1.5 pb-2 z-30">
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
