"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Building2,
  Package,
  Phone,
  ShoppingBag,
  Users,
  QrCode,
  Sparkles,
  CreditCard,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  LogOut,
  Menu,
  X,
  Lock,
  Save,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Business, Product, Order, ClientRecord, OrderStatus } from "@/lib/types";
import { formatKZT, formatDate, slugify } from "@/lib/format";
import { KZ_CITIES } from "@/lib/cities";
import { BUSINESS_CATEGORIES } from "@/lib/categories";
import { BrandLogo } from "@/components/BrandLogo";
import { TiyinAiCenter } from "@/components/TiyinAiCenter";

type TabId =
  | "company"
  | "catalog"
  | "payments"
  | "contacts"
  | "orders"
  | "clients"
  | "share"
  | "ai";

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  web: { label: "Витрина", className: "bg-slate-100 text-slate-700" },
  whatsapp: { label: "WhatsApp", className: "bg-emerald-50 text-emerald-700" },
  instagram: { label: "Instagram", className: "bg-pink-50 text-pink-700" },
  telegram: { label: "Telegram", className: "bg-sky-50 text-sky-700" },
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

  const [activeTab, setActiveTab] = useState<TabId>("company");
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
      setSaveNotice("Изменения сохранены и уже видны на вашей витрине.");
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
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Загрузка кабинета...
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAFAFB]">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4">
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

  // Первый вход владельца бизнеса — создание платформы с выбором города и сферы деятельности
  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#FAFAFB]">
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
  const newOrdersCount = orders.filter((o) => o.status === "new").length;
  const filteredOrders =
    orderSourceFilter === "all"
      ? orders
      : orders.filter((o) => (o.source || "web") === orderSourceFilter);

  const navItems: {
    id: TabId;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    accent?: boolean;
  }[] = [
    { id: "ai", label: "TIYIN AI", icon: <Sparkles className="w-4 h-4" />, accent: true },
    {
      id: "orders",
      label: "Заказы",
      icon: <ShoppingBag className="w-4 h-4" />,
      badge: newOrdersCount > 0 ? newOrdersCount : undefined,
    },
    { id: "catalog", label: "Каталог товаров", icon: <Package className="w-4 h-4" /> },
    { id: "payments", label: "Оплата", icon: <CreditCard className="w-4 h-4" /> },
    { id: "company", label: "О компании", icon: <Building2 className="w-4 h-4" /> },
    { id: "contacts", label: "Контакты", icon: <Phone className="w-4 h-4" /> },
    { id: "clients", label: "База клиентов", icon: <Users className="w-4 h-4" /> },
    { id: "share", label: "Ссылка и QR", icon: <QrCode className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFB] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between sticky top-0 z-30">
        <div className="font-bold text-neutral-950 truncate">{business.name}</div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${business.slug}`}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-900 font-medium"
          >
            Витрина
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } md:flex md:flex-col w-full md:w-64 bg-white border-r border-slate-200 md:min-h-screen p-4 justify-between shrink-0`}
      >
        <div>
          <div className="hidden md:block px-2 py-2 mb-5">
            <Link href="/">
              <BrandLogo size="sm" />
            </Link>
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="font-semibold text-sm text-neutral-950 truncate">
                {business.name}
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                {business.category}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                {business.city} • /{business.slug}
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  activeTab === item.id
                    ? "bg-neutral-950 text-white"
                    : item.accent
                    ? "bg-blue-50/70 text-blue-700 hover:bg-blue-100/70 font-semibold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  {item.label}
                </span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-600 text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
          <Link
            href={`/${business.slug}`}
            target="_blank"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 text-neutral-900 text-sm font-medium hover:bg-slate-200 transition"
          >
            <ExternalLink className="w-4 h-4" />
            Открыть витрину
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти из кабинета
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 max-w-5xl w-full mx-auto">
        {saveNotice && (
          <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl">
            {saveNotice}
          </div>
        )}

        {/* TAB: TIYIN AI */}
        {activeTab === "ai" && (
          <TiyinAiCenter
            accessToken={accessToken}
            business={business}
            orders={orders}
          />
        )}

        {/* TAB: COMPANY */}
        {activeTab === "company" && (
          <form onSubmit={handleSaveBusiness} className="space-y-5 max-w-3xl">
            <div>
              <h1 className="text-2xl font-bold text-neutral-950">О компании и услугах</h1>
              <p className="text-sm text-slate-500">
                Эта информация отображается клиентам в поиске и на вашей витрине
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
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
                    onChange={(e) => setBusiness({ ...business, category: e.target.value })}
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
                    Краткий слоган (виден в поиске)
                  </label>
                  <input
                    type="text"
                    value={business.tagline}
                    onChange={(e) => setBusiness({ ...business, tagline: e.target.value })}
                    placeholder="Например: Авторские букеты и подарки с доставкой"
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
                  placeholder="Расскажите о ваших услугах, преимуществах, условиях работы..."
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
                    onChange={(e) => setBusiness({ ...business, address: e.target.value })}
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition"
              >
                <Save className="w-4 h-4" />
                Сохранить изменения
              </button>
            </div>
          </form>
        )}

        {/* TAB: PAYMENTS (KASPI & HALYK) */}
        {activeTab === "payments" && (
          <form onSubmit={handleSaveBusiness} className="space-y-5 max-w-2xl">
            <div>
              <h1 className="text-2xl font-bold text-neutral-950">Подключение оплаты</h1>
              <p className="text-sm text-slate-500">
                Настройте способы оплаты — аккуратные значки банков автоматически появятся в
                шапке вашей витрины и в корзине клиента
              </p>
            </div>

            {/* Kaspi Pay Block */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#F14635] text-white font-extrabold text-sm flex items-center justify-center">
                    K
                  </span>
                  <div>
                    <div className="font-bold text-neutral-950">Kaspi Pay (ссылка на QR)</div>
                    <div className="text-xs text-slate-500">
                      Клиент переходит прямо в приложение Kaspi.kz для оплаты заказа
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
                  {business.kaspi_pay_link?.trim() ? "Подключен" : "Не указана"}
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
                  Откройте приложение <strong>Kaspi Pay</strong> → «Мой QR» → «Поделиться
                  ссылкой» и вставьте её сюда. Если поле пустое, значок Kaspi на витрине не
                  показывается.
                </p>
              </div>
            </div>

            {/* Halyk Bank Block */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#00805F] text-white font-extrabold text-sm flex items-center justify-center">
                    H
                  </span>
                  <div>
                    <div className="font-bold text-neutral-950">Halyk Bank / ePay</div>
                    <div className="text-xs text-slate-500">
                      Прием оплаты через Halyk QR и карты (автоматический API ePay скоро)
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
                    className="w-4 h-4 rounded border-slate-300 accent-neutral-950"
                  />
                  <span className="text-xs font-semibold text-neutral-800">Включить</span>
                </label>
              </div>
              <p className="text-[11px] text-slate-400">
                При включении значок Halyk появится на вашей витрине и в списке способов
                оплаты при оформлении заказа.
              </p>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition"
            >
              <Save className="w-4 h-4" />
              Сохранить способы оплаты
            </button>
          </form>
        )}

        {/* TAB: CATALOG */}
        {activeTab === "catalog" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-neutral-950">Каталог товаров и услуг</h1>
              <p className="text-sm text-slate-500">
                Добавляйте позиции — они сразу появятся на витрине и в ответах TIYIN AI
              </p>
            </div>

            <form
              onSubmit={handleAddProduct}
              className="bg-white p-5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <input
                type="text"
                placeholder="Название товара / услуги"
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
                placeholder="Категория"
                value={newProdCategory}
                onChange={(e) => setNewProdCategory(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
              <input
                type="text"
                placeholder="Краткое описание (необязательно)"
                value={newProdDesc}
                onChange={(e) => setNewProdDesc(e.target.value)}
                className="sm:col-span-2 lg:col-span-4 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
              {products.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  В каталоге пока пусто. Добавьте первый товар или услугу выше.
                </div>
              )}
              {products.map((prod) => (
                <div
                  key={prod.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-950">{prod.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {prod.category}
                      </span>
                    </div>
                    {prod.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{prod.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-neutral-950">
                      {formatKZT(prod.price)}
                    </span>
                    <button
                      onClick={() => toggleProduct(prod)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
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
              ))}
            </div>
          </div>
        )}

        {/* TAB: CONTACTS */}
        {activeTab === "contacts" && (
          <form onSubmit={handleSaveBusiness} className="space-y-5 max-w-xl">
            <div>
              <h1 className="text-2xl font-bold text-neutral-950">Контакты для клиентов</h1>
              <p className="text-sm text-slate-500">
                Появятся на вашей витрине в виде удобных кнопок связи
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition"
              >
                <Save className="w-4 h-4" />
                Сохранить контакты
              </button>
            </div>
          </form>
        )}

        {/* TAB: ORDERS (UNIFIED FEED ACROSS ALL CHANNELS) */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-neutral-950">Единая лента заказов</h1>
                <p className="text-sm text-slate-500">
                  Все заявки с витрины, WhatsApp, Instagram и Telegram в одном окне
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
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
                Заказов в этом разделе пока нет.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((ord) => {
                  const src = SOURCE_LABELS[ord.source || "web"] || SOURCE_LABELS.web;
                  return (
                    <div
                      key={ord.id}
                      className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                        <div className="text-sm font-medium text-slate-800">
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

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                        <div className="text-lg font-bold text-neutral-950">
                          {formatKZT(ord.total_price)}
                        </div>
                        <select
                          value={ord.status}
                          onChange={(e) =>
                            updateOrderStatus(ord.id, e.target.value as OrderStatus)
                          }
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white"
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

        {/* TAB: CLIENTS */}
        {activeTab === "clients" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-950">База клиентов</h1>
              <p className="text-sm text-slate-500">
                Формируется автоматически после каждого заказа с витрины и из TIYIN AI
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
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
                        <td className="px-5 py-3.5 font-medium text-neutral-950">{c.name}</td>
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

        {/* TAB: SHARE & QR */}
        {activeTab === "share" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-neutral-950">
                Ссылка и QR-код вашей витрины
              </h1>
              <p className="text-sm text-slate-500">
                Отправляйте клиентам в WhatsApp, Instagram или разместите QR на стойке
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center gap-8">
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
                      onClick={() => {
                        navigator.clipboard.writeText(publicUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-medium hover:bg-neutral-800"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Скопировано" : "Копировать"}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Распечатать QR-код
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
