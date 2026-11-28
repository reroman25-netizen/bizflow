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
  Mail,
  KeyRound,
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
  Send,
  FileText,
  Download,
  UserPlus,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Palette,
  Truck,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  Business,
  Product,
  ProductItemType,
  Order,
  ClientRecord,
  OrderStatus,
  PaymentStatus,
  StorefrontTemplate,
  TelegramOrderRecipient,
  DeliveryRecord,
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
import { VisualStorefrontEditor } from "@/components/VisualStorefrontEditor";
import { YandexDeliverySettings } from "@/components/YandexDeliverySettings";
import { canActivateFreeProTrial, hasActiveProAccess, getProPlanLabel, SAAS_BASE_MONTHLY_PRICE, SAAS_BASE_TRIAL_MONTHS, SAAS_PRO_MONTHLY_PRICE } from "@/lib/proPlan";
import { OrderDeliveryControl } from "@/components/OrderDeliveryControl";
import { evaluateClientDelivery } from "@/lib/deliveryPricing";
import { CURRENT_OFFER_VERSION } from "@/lib/legalDocs";
import {
  BRAND_COLOR_PRESETS,
  extractDominantColorFromFile,
  extractDominantColorFromUrl,
} from "@/lib/brandColor";

type MainTab = "home" | "orders" | "ai" | "catalog" | "settings";
type SettingsSection = "menu" | "company" | "payments" | "delivery" | "contacts" | "clients" | "share";

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
  const [userEmail, setUserEmail] = useState<string>("");
  const [linkEmailInput, setLinkEmailInput] = useState<string>("");
  const [linkPasswordInput, setLinkPasswordInput] = useState<string>("");
  const [linkingEmail, setLinkingEmail] = useState<boolean>(false);
  const [linkEmailError, setLinkEmailError] = useState<string>("");
  const [tgLinkCode, setTgLinkCode] = useState<string>("");
  const [tgDeepLink, setTgDeepLink] = useState<string>("");
  const [generatingTgCode, setGeneratingTgCode] = useState<boolean>(false);

  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveriesByOrder, setDeliveriesByOrder] = useState<Record<string, DeliveryRecord>>({});
  const [clients, setClients] = useState<ClientRecord[]>([]);

  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("menu");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>("all");
  const [ordersSubTab, setOrdersSubTab] = useState<"orders" | "clients">("orders");
  const [previewReceiptOrder, setPreviewReceiptOrder] = useState<Order | null>(null);

  // Telegram order recipients (owner / managers without dashboard access)
  const [tgRecipients, setTgRecipients] = useState<TelegramOrderRecipient[]>([]);
  const [tgRecipientsLoading, setTgRecipientsLoading] = useState(false);
  const [tgRecipientsSaving, setTgRecipientsSaving] = useState(false);
  const [newRecName, setNewRecName] = useState("");
  const [newRecChatId, setNewRecChatId] = useState("");
  const [tgRecMessage, setTgRecMessage] = useState("");
  const [tgRecError, setTgRecError] = useState("");
  const [testingChatId, setTestingChatId] = useState<string | null>(null);

  // Bank API Payment Settings (Halyk ePay & Freedom Pay)
  const [halykApiEnabled, setHalykApiEnabled] = useState(false);
  const [halykClientId, setHalykClientId] = useState("");
  const [halykClientSecret, setHalykClientSecret] = useState("");
  const [halykTerminalId, setHalykTerminalId] = useState("");
  const [halykHasSecret, setHalykHasSecret] = useState(false);
  const [halykTestMode, setHalykTestMode] = useState(true);
  const [showHalykGuide, setShowHalykGuide] = useState(false);

  const [freedomApiEnabled, setFreedomApiEnabled] = useState(false);
  const [freedomMerchantId, setFreedomMerchantId] = useState("");
  const [freedomSecretKey, setFreedomSecretKey] = useState("");
  const [freedomHasSecret, setFreedomHasSecret] = useState(false);
  const [freedomTestMode, setFreedomTestMode] = useState(true);
  const [showFreedomGuide, setShowFreedomGuide] = useState(false);

  const [savingPayments, setSavingPayments] = useState(false);
  const [activatingPro, setActivatingPro] = useState(false);
  const [paymentSaveError, setPaymentSaveError] = useState("");
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
  const [createLegalName, setCreateLegalName] = useState("");
  const [createBinIin, setCreateBinIin] = useState("");
  const [createOfferAccepted, setCreateOfferAccepted] = useState(false);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // New product form
  const [newProdName, setNewProdName] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Основное");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdType, setNewProdType] = useState<ProductItemType>("product");
  const [newProdDuration, setNewProdDuration] = useState("");
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
      pwa_short_name: (biz as Business).pwa_short_name || "",
      pwa_enabled: (biz as Business).pwa_enabled ?? true,
      storefront_template:
        (biz as Business).storefront_template === "services" ? "services" : "shop",
      brand_color: (biz as Business).brand_color || "#111827",
      plan_tier: (biz as Business).plan_tier || "base",
      pro_trial_used: Boolean((biz as Business).pro_trial_used),
      pro_trial_ends_at: (biz as Business).pro_trial_ends_at || null,
      trial_ends_at: (biz as Business).trial_ends_at || null,
      paid_until: (biz as Business).paid_until || null,
      billing_note: (biz as Business).billing_note || "",
      kaspi_pay_link: (biz as Business).kaspi_pay_link || "",
      halyk_enabled: Boolean((biz as Business).halyk_enabled),
      halyk_api_enabled: Boolean((biz as Business).halyk_api_enabled),
      freedom_api_enabled: Boolean((biz as Business).freedom_api_enabled),
      delivery_enabled: Boolean((biz as Business).delivery_enabled),
      delivery_api_enabled: Boolean((biz as Business).delivery_api_enabled),
      delivery_pricing_mode:
        (biz as Business).delivery_pricing_mode === "included" ? "included" : "fixed",
      delivery_fixed_price: Number((biz as Business).delivery_fixed_price || 0),
      delivery_free_from: (biz as Business).delivery_free_from ?? null,
      delivery_min_order: (biz as Business).delivery_min_order ?? null,
      delivery_show_included_badge: (biz as Business).delivery_show_included_badge !== false,
      delivery_pickup_address: (biz as Business).delivery_pickup_address || "",
      delivery_pickup_lat: (biz as Business).delivery_pickup_lat ?? null,
      delivery_pickup_lng: (biz as Business).delivery_pickup_lng ?? null,
      delivery_pickup_entrance: (biz as Business).delivery_pickup_entrance || "",
      delivery_pickup_phone: (biz as Business).delivery_pickup_phone || "",
      delivery_pickup_comment: (biz as Business).delivery_pickup_comment || "",
      legal_name: (biz as Business).legal_name || "",
      bin_iin: (biz as Business).bin_iin || "",
      offer_accepted_at: (biz as Business).offer_accepted_at || null,
      offer_version: (biz as Business).offer_version || "",
    };
    setBusiness(typedBiz);

    const [prodRes, ordRes, cliRes, delivRes] = await Promise.all([
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
      supabase
        .from("deliveries")
        .select("*")
        .eq("business_id", typedBiz.id)
        .order("created_at", { ascending: false }),
    ]);

    setProducts((prodRes.data as Product[]) || []);
    setOrders((ordRes.data as Order[]) || []);
    setClients((cliRes.data as ClientRecord[]) || []);

    const dMap: Record<string, DeliveryRecord> = {};
    for (const d of ((delivRes.data as DeliveryRecord[]) || [])) {
      const existing = dMap[d.order_id];
      const isNewActive = !["cancelled", "failed"].includes(d.status);
      const isExistingActive = existing && !["cancelled", "failed"].includes(existing.status);
      if (!existing || (isNewActive && !isExistingActive)) {
        dMap[d.order_id] = d;
      }
    }
    setDeliveriesByOrder(dMap);
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

      if (!session?.user) {
        router.replace("/auth?mode=business&tab=login");
        return;
      }

      // Проверяем, что сессия реально живая на сервере (иначе авто-сброс)
      const { data: verifiedUserData, error: verifiedUserErr } =
        await supabase.auth.getUser();

      if (verifiedUserErr || !verifiedUserData.user) {
        await supabase.auth.signOut();
        router.replace("/auth?mode=business&tab=login");
        return;
      }

      const user = verifiedUserData.user;

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
      setUserEmail(user.email || "");
      await loadBusinessData(user.id);

      setTgRecipientsLoading(true);
      try {
        const recRes = await fetch("/api/dashboard/order-recipients", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (recRes.ok) {
          const recJson = await recRes.json();
          if (Array.isArray(recJson.recipients)) {
            setTgRecipients(recJson.recipients);
          }
        }
      } catch {
        // ignore
      } finally {
        setTgRecipientsLoading(false);
      }

      try {
        const payRes = await fetch("/api/dashboard/payment-settings", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (payRes.ok) {
          const payJson = await payRes.json();
          const s = payJson.settings;
          if (s) {
            setHalykApiEnabled(Boolean(s.halyk_api_enabled));
            setHalykClientId(s.halyk_client_id || "");
            setHalykTerminalId(s.halyk_terminal_id || "");
            setHalykHasSecret(Boolean(s.halyk_has_secret));
            setHalykTestMode(s.halyk_test_mode ?? true);
            setFreedomApiEnabled(Boolean(s.freedom_api_enabled));
            setFreedomMerchantId(s.freedom_merchant_id || "");
            setFreedomHasSecret(Boolean(s.freedom_has_secret));
            setFreedomTestMode(s.freedom_test_mode ?? true);
          }
        }
      } catch {
        // ignore
      }
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

  const handleActivateProTrial = async () => {
    if (!accessToken || !business) return;
    setActivatingPro(true);
    setUploadError("");
    try {
      const res = await fetch("/api/dashboard/subscription/activate-pro-trial", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error || "Не удалось активировать пробный период PRO.");
        return;
      }
      setBusiness((prev) =>
        prev
          ? {
              ...prev,
              plan_tier: "pro",
              pro_trial_used: true,
              pro_trial_ends_at: json.pro_trial_ends_at,
              trial_ends_at: json.trial_ends_at,
            }
          : prev
      );
      showNotice("Тариф «Бизнес PRO» активирован бесплатно на 30 дней! API банков и Яндекс Доставка открыты.");
    } catch {
      setUploadError("Ошибка сети при активации Бизнес PRO.");
    } finally {
      setActivatingPro(false);
    }
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

    if (!createOfferAccepted) {
      setCreateError("Подтвердите согласие с Договором оферты и Политикой конфиденциальности.");
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
      legal_name: createLegalName.trim(),
      bin_iin: createBinIin.replace(/\D/g, "").slice(0, 12),
      offer_accepted_at: new Date().toISOString(),
      offer_version: CURRENT_OFFER_VERSION,
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
        pwa_short_name: (business.pwa_short_name || "").trim().slice(0, 12),
        storefront_template: business.storefront_template || "shop",
        brand_color: (business.brand_color || "#111827").trim(),
        kaspi_pay_link: (business.kaspi_pay_link || "").trim(),
        halyk_enabled: Boolean(business.halyk_enabled),
        legal_name: (business.legal_name || "").trim(),
        bin_iin: (business.bin_iin || "").replace(/\D/g, "").slice(0, 12),
      })
      .eq("id", business.id);

    if (!error) {
      showNotice("Изменения сохранены и уже видны на витрине.");
    }
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !accessToken) return;
    setSavingPayments(true);
    setPaymentSaveError("");
    try {
      const res = await fetch("/api/dashboard/payment-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          kaspi_pay_link: (business.kaspi_pay_link || "").trim(),
          halyk_enabled: Boolean(business.halyk_enabled),
          halyk_api_enabled: halykApiEnabled,
          halyk_client_id: halykClientId.trim(),
          halyk_client_secret: halykClientSecret.trim(),
          halyk_terminal_id: halykTerminalId.trim(),
          halyk_test_mode: halykTestMode,
          freedom_api_enabled: freedomApiEnabled,
          freedom_merchant_id: freedomMerchantId.trim(),
          freedom_secret_key: freedomSecretKey.trim(),
          freedom_test_mode: freedomTestMode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPaymentSaveError(json.error || "Не удалось сохранить настройки оплаты.");
        return;
      }
      const s = json.settings;
      if (s) {
        setBusiness({
          ...business,
          kaspi_pay_link: s.kaspi_pay_link,
          halyk_enabled: s.halyk_enabled,
          halyk_api_enabled: s.halyk_api_enabled,
          freedom_api_enabled: s.freedom_api_enabled,
        });
        setHalykHasSecret(Boolean(s.halyk_has_secret));
        setFreedomHasSecret(Boolean(s.freedom_has_secret));
        setHalykClientSecret("");
        setFreedomSecretKey("");
      }
      showNotice("Настройки оплаты сохранены и уже активны на витрине!");
    } catch {
      setPaymentSaveError("Ошибка соединения с сервером.");
    } finally {
      setSavingPayments(false);
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

    const [res, autoColor] = await Promise.all([
      uploadBusinessMedia({
        businessId: business.id,
        folder: "logos",
        file,
      }),
      extractDominantColorFromFile(file),
    ]);

    setUploadingLogo(false);
    e.target.value = "";

    if (res.error || !res.url) {
      setUploadError(res.error || "Ошибка загрузки логотипа.");
      return;
    }

    const nextColor = autoColor || business.brand_color || "#111827";
    const updated = { ...business, logo_url: res.url, brand_color: nextColor };
    setBusiness(updated);
    const supabase = getSupabaseClient();
    await supabase
      .from("businesses")
      .update({ logo_url: res.url, brand_color: nextColor })
      .eq("id", business.id);
    showNotice(
      autoColor
        ? "Логотип обновлён и цвет бренда подобран автоматически!"
        : "Логотип приложения обновлён!"
    );
  };

  const handleSaveBrandColor = async (hexColor: string) => {
    if (!business) return;
    const cleanHex = hexColor.trim() || "#111827";
    setBusiness({ ...business, brand_color: cleanHex });
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("businesses")
      .update({ brand_color: cleanHex })
      .eq("id", business.id);
    if (!error) {
      showNotice("Цвет бренда обновлён на витрине!");
    }
  };

  const handleAutoPickBrandColor = async () => {
    if (!business?.logo_url) return;
    const detected = await extractDominantColorFromUrl(business.logo_url);
    if (!detected) {
      setUploadError(
        "Не удалось автоматически считать цвет с этого логотипа — выберите цвет вручную ниже."
      );
      return;
    }
    await handleSaveBrandColor(detected);
  };

  const handleRemoveLogo = async () => {
    if (!business) return;
    setBusiness({ ...business, logo_url: "" });
    const supabase = getSupabaseClient();
    await supabase.from("businesses").update({ logo_url: "" }).eq("id", business.id);
    showNotice("Логотип удален (будет использоваться иконка с инициалами бизнеса).");
  };

  const handleSavePwaShortName = async () => {
    if (!business) return;
    const cleanShort = (business.pwa_short_name || "").trim().slice(0, 12);
    setBusiness({ ...business, pwa_short_name: cleanShort });
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("businesses")
      .update({ pwa_short_name: cleanShort })
      .eq("id", business.id);
    if (!error) {
      showNotice("Короткое имя приложения сохранено!");
    }
  };

  const handleSelectStorefrontTemplate = async (tpl: StorefrontTemplate) => {
    if (!business) return;
    setBusiness({ ...business, storefront_template: tpl });
    if (tpl === "services") {
      setNewProdType("service");
    } else {
      setNewProdType("product");
    }
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("businesses")
      .update({ storefront_template: tpl })
      .eq("id", business.id);
    if (!error) {
      showNotice(
        tpl === "services"
          ? "Включён шаблон «Услуги и запись»!"
          : "Включён шаблон «Магазин / Еда»!"
      );
    }
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
        duration_label: newProdDuration.trim(),
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
      setNewProdDuration("");
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

  const updateOrderPaymentStatus = async (
    orderId: string,
    paymentStatus: PaymentStatus
  ) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: paymentStatus })
      .eq("id", orderId);
    if (!error) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, payment_status: paymentStatus } : o
        )
      );
      if (previewReceiptOrder?.id === orderId) {
        setPreviewReceiptOrder({
          ...previewReceiptOrder,
          payment_status: paymentStatus,
        });
      }
      showNotice(
        paymentStatus === "paid"
          ? "Оплата по заказу подтверждена!"
          : "Статус оплаты обновлён."
      );
    }
  };

  const saveTelegramRecipients = async (nextList: TelegramOrderRecipient[]) => {
    if (!accessToken) return;
    setTgRecipientsSaving(true);
    setTgRecError("");
    setTgRecMessage("");
    try {
      const res = await fetch("/api/dashboard/order-recipients", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ recipients: nextList }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTgRecError(json.error || "Не удалось сохранить получателей.");
      } else {
        setTgRecipients(json.recipients || nextList);
        setTgRecMessage("Список получателей обновлён!");
        setTimeout(() => setTgRecMessage(""), 3000);
      }
    } catch {
      setTgRecError("Ошибка сети при сохранении.");
    } finally {
      setTgRecipientsSaving(false);
    }
  };

  const handleAddTgRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newRecChatId.trim();
    const cleanName = newRecName.trim() || "Менеджер";
    if (!cleanId) return;
    if (tgRecipients.some((r) => r.chat_id === cleanId)) {
      setTgRecError("Этот Telegram ID уже добавлен в список.");
      return;
    }
    const nextList: TelegramOrderRecipient[] = [
      ...tgRecipients,
      { id: `rec-${Date.now()}`, name: cleanName, chat_id: cleanId },
    ];
    await saveTelegramRecipients(nextList);
    setNewRecName("");
    setNewRecChatId("");
  };

  const handleRemoveTgRecipient = async (id: string) => {
    const nextList = tgRecipients.filter((r) => r.id !== id);
    await saveTelegramRecipients(nextList);
  };

  const handleTestTgRecipient = async (rec: TelegramOrderRecipient) => {
    if (!accessToken) return;
    setTestingChatId(rec.chat_id);
    setTgRecError("");
    setTgRecMessage("");
    try {
      const res = await fetch("/api/dashboard/order-recipients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ chatId: rec.chat_id, name: rec.name }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTgRecError(json.error || "Не удалось отправить тест.");
      } else {
        setTgRecMessage(`Тестовое сообщение отправлено: ${rec.name}`);
        setTimeout(() => setTgRecMessage(""), 3500);
      }
    } catch {
      setTgRecError("Ошибка соединения при отправке теста.");
    } finally {
      setTestingChatId(null);
    }
  };

  const isSyntheticEmail =
    !userEmail ||
    (userEmail.startsWith("tg_") && userEmail.endsWith("@telegram.tiyin.kz"));

  const handleGenerateTelegramLinkCode = async () => {
    if (!accessToken) return;
    setGeneratingTgCode(true);
    setUploadError("");
    try {
      const res = await fetch("/api/auth/telegram-link-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setUploadError(json.error || "Не удалось создать код для Telegram.");
        return;
      }
      setTgLinkCode(json.code || "");
      setTgDeepLink(json.deepLink || "");
    } catch {
      setUploadError("Ошибка соединения при создании кода.");
    } finally {
      setGeneratingTgCode(false);
    }
  };

  const handleLinkEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setLinkEmailError("");
    setLinkingEmail(true);
    try {
      const res = await fetch("/api/auth/link-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: linkEmailInput.trim(),
          password: linkPasswordInput,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLinkEmailError(json.error || "Не удалось привязать почту.");
        return;
      }
      setUserEmail(json.email || linkEmailInput.trim().toLowerCase());
      setLinkEmailInput("");
      setLinkPasswordInput("");
      showNotice(
        "Почта подключена! Теперь вы можете входить через Telegram, по почте или через Google (если указали Gmail)."
      );
    } catch {
      setLinkEmailError("Ошибка соединения с сервером.");
    } finally {
      setLinkingEmail(false);
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
              {SAAS_BASE_TRIAL_MONTHS} месяца бесплатно · далее {formatKZT(SAAS_BASE_MONTHLY_PRICE)}/мес (Бизнес PRO 4 990 ₸ — 1 мес. бесплатно)
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Юридическое название (ИП / ТОО)
                </label>
                <input
                  type="text"
                  value={createLegalName}
                  onChange={(e) => setCreateLegalName(e.target.value)}
                  placeholder="Напр. ИП «Ameli»"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  ИИН / БИН (12 цифр)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  value={createBinIin}
                  onChange={(e) =>
                    setCreateBinIin(e.target.value.replace(/\D/g, "").slice(0, 12))
                  }
                  placeholder="123456789012"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={createOfferAccepted}
                onChange={(e) => setCreateOfferAccepted(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 accent-neutral-950 shrink-0"
                required
              />
              <span className="leading-relaxed">
                Я принимаю условия{" "}
                <Link href="/offer" target="_blank" className="font-semibold text-neutral-950 underline">
                  Оферты SaaS для бизнеса (v3.0)
                </Link>{" "}
                и{" "}
                <Link href="/privacy" target="_blank" className="font-semibold text-neutral-950 underline">
                  Политики конфиденциальности
                </Link>
                , даю согласие на обработку и трансграничную передачу ПД (Telegram, Google AI) и подтверждаю, что не буду размещать запрещённые в РК товары.
              </span>
            </label>

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
    Boolean(business.kaspi_pay_link?.trim()) ||
    Boolean(business.halyk_enabled) ||
    Boolean(business.halyk_api_enabled) ||
    Boolean(business.freedom_api_enabled);
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
                  onClick={() => {
                    setActiveTab("orders");
                    setOrdersSubTab("clients");
                  }}
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

        {/* TAB 2: ORDERS + CLIENTS + TELEGRAM RECIPIENTS */}
        {activeTab === "orders" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-neutral-950">
                  {ordersSubTab === "orders" ? "Заказы" : "База клиентов"}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  {ordersSubTab === "orders"
                    ? "Заявки, чеки оплаты Kaspi и мгновенная доставка в Telegram"
                    : "Все клиенты, которые оформляли заказы или записи"}
                </p>
              </div>

              {/* Sub-tab switcher: Заказы | База клиентов */}
              <div className="inline-flex p-1 rounded-2xl bg-white border border-slate-200/90 shadow-sm self-start">
                <button
                  type="button"
                  onClick={() => setOrdersSubTab("orders")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 ${
                    ordersSubTab === "orders"
                      ? "bg-neutral-950 text-white shadow-sm"
                      : "text-slate-600 hover:text-neutral-950"
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Заказы ({orders.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersSubTab("clients")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 ${
                    ordersSubTab === "clients"
                      ? "bg-neutral-950 text-white shadow-sm"
                      : "text-slate-600 hover:text-neutral-950"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Клиенты ({clients.length})</span>
                </button>
              </div>
            </div>

            {ordersSubTab === "orders" ? (
              <>
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

                {filteredOrders.length === 0 ? (
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-sm text-slate-500 shadow-sm">
                    Заказов в этом разделе пока нет.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredOrders.map((ord) => {
                      const src = SOURCE_LABELS[ord.source || "web"] || SOURCE_LABELS.web;
                      const isKaspi =
                        ord.payment_provider === "kaspi" ||
                        (ord.payment_method || "").toLowerCase().includes("kaspi");
                      const payStatus = ord.payment_status || "unpaid";

                      return (
                        <div
                          key={ord.id}
                          className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-neutral-950">
                                  {ord.order_code}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${src.className}`}
                                >
                                  {src.label}
                                </span>
                                {payStatus === "paid" && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                                    Оплачено
                                    {ord.payment_provider === "halyk"
                                      ? " · Halyk ePay"
                                      : ord.payment_provider === "freedom"
                                      ? " · Freedom Pay"
                                      : ""}
                                  </span>
                                )}
                                {payStatus === "pending_review" && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/70">
                                    Чек Kaspi на проверке
                                  </span>
                                )}
                                {payStatus === "unpaid" && isKaspi && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">
                                    Ожидает чек Kaspi
                                  </span>
                                )}
                                {payStatus === "unpaid" &&
                                  (ord.payment_provider === "halyk" ||
                                    ord.payment_provider === "freedom") && (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700">
                                      Ожидает онлайн-оплату
                                    </span>
                                  )}
                                {payStatus === "failed" && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 text-red-700">
                                    Оплата не прошла
                                  </span>
                                )}
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
                                  <span>
                                    • Получение: {ord.delivery_method}
                                    {ord.delivery_fee && ord.delivery_fee > 0
                                      ? ` (+${formatKZT(ord.delivery_fee)})`
                                      : ""}
                                  </span>
                                )}
                              </div>
                              {ord.comment && (
                                <div className="text-xs text-slate-500">
                                  Комментарий / адрес: {ord.comment}
                                </div>
                              )}
                              <div className="text-sm text-slate-700 pt-1">
                                {Array.isArray(ord.items)
                                  ? ord.items
                                      .map((i) => `${i.name} ×${i.quantity}`)
                                      .join(", ")
                                  : ""}
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
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

                          {/* Kaspi Receipt Bar inside Order Card */}
                          {ord.receipt_url && (
                            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPreviewReceiptOrder(ord)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Посмотреть чек</span>
                                </button>
                                <a
                                  href={ord.receipt_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-800 text-xs font-semibold transition"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Сохранить</span>
                                </a>
                              </div>

                              {payStatus !== "paid" && (
                                <button
                                  type="button"
                                  onClick={() => updateOrderPaymentStatus(ord.id, "paid")}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-sm"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Подтвердить оплату</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* TIYIN Delivery Control (Yandex Courier on Demand) */}
                          <OrderDeliveryControl
                            order={ord}
                            delivery={deliveriesByOrder[ord.id] || null}
                            accessToken={accessToken}
                            onDeliveryUpdated={(updated) =>
                              setDeliveriesByOrder((prev) => ({
                                ...prev,
                                [ord.id]: updated,
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* INSTANT TELEGRAM ORDER RECIPIENTS (BOTTOM OF ORDERS TAB) */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                        <Send className="w-5 h-5" />
                      </span>
                      <div>
                        <h2 className="font-bold text-base text-neutral-950">
                          Мгновенные заказы и чеки в Telegram
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Добавьте себя, менеджера или продавца. Заказы и чеки Kaspi будут
                          приходить им прямо в Telegram — <strong>без доступа в ваш кабинет</strong>.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Current recipients list */}
                  {tgRecipientsLoading ? (
                    <div className="text-xs text-slate-400">Загрузка получателей...</div>
                  ) : tgRecipients.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                      Получатели пока не добавлены — укажите Telegram Chat ID ниже, чтобы
                      заказы и чеки приходили мгновенно.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tgRecipients.map((rec) => (
                        <div
                          key={rec.id}
                          className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/80"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-neutral-950 truncate">
                              {rec.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              Chat ID: <span className="font-mono">{rec.chat_id}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={testingChatId === rec.chat_id}
                              onClick={() => handleTestTgRecipient(rec)}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-neutral-800 transition disabled:opacity-50"
                            >
                              {testingChatId === rec.chat_id ? "Отправка..." : "Тест"}
                            </button>
                            <button
                              type="button"
                              disabled={tgRecipientsSaving}
                              onClick={() => handleRemoveTgRecipient(rec.id)}
                              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                              title="Удалить получателя"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new recipient form */}
                  <form
                    onSubmit={handleAddTgRecipient}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5 pt-1"
                  >
                    <input
                      type="text"
                      placeholder="Имя / роль (напр. Менеджер Айгуль)"
                      value={newRecName}
                      onChange={(e) => setNewRecName(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                    <input
                      type="text"
                      placeholder="Telegram Chat ID (напр. 123456789)"
                      value={newRecChatId}
                      onChange={(e) => setNewRecChatId(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      required
                    />
                    <button
                      type="submit"
                      disabled={tgRecipientsSaving}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Добавить</span>
                    </button>
                  </form>

                  {tgRecMessage && (
                    <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                      {tgRecMessage}
                    </div>
                  )}
                  {tgRecError && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                      {tgRecError}
                    </div>
                  )}

                  <div className="rounded-2xl bg-sky-50/70 border border-sky-200/70 p-3.5 text-[11px] text-sky-950 space-y-1 leading-relaxed">
                    <div className="font-bold text-sky-900">
                      Как подключить менеджера или продавца за 30 секунд:
                    </div>
                    <div>
                      1. Пусть сотрудник откроет в Telegram бота{" "}
                      <a
                        href="https://t.me/tiyinapp_bot"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold underline"
                      >
                        @tiyinapp_bot
                      </a>{" "}
                      и нажмёт <strong>Start</strong> (иначе Telegram не даст боту написать первым).
                    </div>
                    <div>
                      2. Пусть откроет{" "}
                      <a
                        href="https://t.me/userinfobot"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold underline"
                      >
                        @userinfobot
                      </a>
                      , скопирует свой цифровой <strong>Id</strong> и отправит вам.
                    </div>
                    <div>
                      3. Вставьте его ID в поле выше, нажмите <strong>Добавить</strong> и проверьте
                      кнопкой <strong>Тест</strong>.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* SUB-TAB: CLIENTS DATABASE */
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

        {/* TAB 4: VISUAL STOREFRONT & CATALOG EDITOR */}
        {activeTab === "catalog" && (
          <VisualStorefrontEditor
            business={business}
            products={products}
            onProductsChange={setProducts}
            onNotice={showNotice}
            onError={setUploadError}
            initialOpenAddProduct={addProductOpen}
            onConsumedInitialAdd={() => setAddProductOpen(false)}
          />
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
                        {getProPlanLabel(business.plan_tier)}
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
                      Базовый: <strong>{formatKZT(SAAS_BASE_MONTHLY_PRICE)}/мес</strong> (3 мес. бесплатно) · PRO: <strong>{formatKZT(SAAS_PRO_MONTHLY_PRICE)}/мес</strong> (1 мес. бесплатно)
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

                {canActivateFreeProTrial(business) && (
                  <div className="rounded-3xl bg-neutral-950 text-white p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Попробуйте Бизнес PRO бесплатно (1 месяц)
                      </div>
                      <div className="text-xs text-white/80 leading-relaxed">
                        Откройте авто-оплату через API банков (Halyk ePay / Freedom Pay) и вызов курьеров через ваш API Яндекс Доставки. Далее {formatKZT(SAAS_PRO_MONTHLY_PRICE)}/мес.
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={activatingPro}
                      onClick={handleActivateProTrial}
                      className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-extrabold shrink-0 transition disabled:opacity-50"
                    >
                      {activatingPro ? "Включаем..." : "Включить PRO бесплатно"}
                    </button>
                  </div>
                )}

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
                          О компании, логотип и цвет бренда
                        </div>
                        <div className="text-xs text-slate-500">
                          {business.category} •{" "}
                          {business.pwa_short_name || business.name}
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
                          Подключение оплаты (Kaspi / Halyk / Freedom)
                        </div>
                        <div className="text-xs text-slate-500">
                          {hasPaymentConfigured
                            ? [
                                business.kaspi_pay_link?.trim() ? "Kaspi Pay" : "",
                                business.halyk_api_enabled
                                  ? "Halyk ePay API"
                                  : business.halyk_enabled
                                  ? "Halyk"
                                  : "",
                                business.freedom_api_enabled ? "Freedom Pay API" : "",
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
                    onClick={() => setSettingsSection("delivery")}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                        <Truck className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-neutral-950">
                          Доставка и Яндекс Курьер (API)
                        </div>
                        <div className="text-xs text-slate-500">
                          {business.delivery_enabled
                            ? evaluateClientDelivery(business, 0).shortBadge || "Включена"
                            : "Настроить цены доставки и API Яндекс Курьера"}
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

                {/* Unified Auth & Notifications Card (Google/Email + Telegram) */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Способы входа и уведомления
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Один аккаунт для сайта (Google / почта) и Telegram Mini App. Привязанный Telegram автоматически получает все заказы и чеки.
                    </p>
                  </div>

                  {/* 1. Telegram block */}
                  <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                          <Send className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-neutral-950">
                            Telegram (вход + уведомления)
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            {linkedTelegramId
                              ? `${
                                  linkedTelegramUsername
                                    ? `@${linkedTelegramUsername}`
                                    : `ID ${linkedTelegramId}`
                                } · вход в 1 клик и уведомления активны`
                              : "Привяжите Telegram для входа в 1 клик и получения заказов"}
                          </div>
                        </div>
                      </div>
                      {linkedTelegramId && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold shrink-0">
                          Подключён
                        </span>
                      )}
                    </div>

                    {!linkedTelegramId && (
                      <div className="space-y-2.5 pt-1">
                        <TelegramAuthButton
                          action="link"
                          accessToken={accessToken}
                          label="Привязать Telegram к кабинету"
                          onSuccess={async (res) => {
                            if (res.telegram_id) {
                              setLinkedTelegramId(res.telegram_id);
                              setLinkedTelegramUsername(res.telegram_username || "");
                              setTgLinkCode("");
                              setTgDeepLink("");
                              showNotice(
                                "Telegram привязан! Вход в 1 клик и уведомления о заказах включены автоматически."
                              );
                              try {
                                const recRes = await fetch("/api/dashboard/order-recipients", {
                                  headers: { Authorization: `Bearer ${accessToken}` },
                                });
                                if (recRes.ok) {
                                  const recJson = await recRes.json();
                                  if (Array.isArray(recJson.recipients)) {
                                    setTgRecipients(recJson.recipients);
                                  }
                                }
                              } catch {
                                // ignore
                              }
                            }
                          }}
                          onError={(msg) => setUploadError(msg)}
                        />

                        {!tgLinkCode ? (
                          <button
                            type="button"
                            disabled={generatingTgCode}
                            onClick={handleGenerateTelegramLinkCode}
                            className="w-full py-2.5 px-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-neutral-800 inline-flex items-center justify-center gap-1.5 transition"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>
                              {generatingTgCode
                                ? "Генерируем код..."
                                : "Код / ссылка для Telegram Mini App"}
                            </span>
                          </button>
                        ) : (
                          <div className="rounded-xl bg-white border border-sky-200 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-600">
                                6-значный код (действует 15 мин):
                              </span>
                              <span className="font-mono text-base font-extrabold tracking-widest text-neutral-950 bg-slate-100 px-2.5 py-1 rounded-lg">
                                {tgLinkCode}
                              </span>
                            </div>
                            {tgDeepLink && (
                              <a
                                href={tgDeepLink}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full py-2.5 px-3.5 rounded-xl bg-[#229ED9] hover:bg-[#1c8cc2] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Открыть Telegram и привязать в 1 клик</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Google / Email block */}
                  <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-neutral-200/80 text-neutral-900 flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-neutral-950">
                            Google / Электронная почта
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            {!isSyntheticEmail
                              ? userEmail
                              : "Укажите ваш Gmail и пароль — сможете входить через Google или почту с любого браузера"}
                          </div>
                        </div>
                      </div>
                      {!isSyntheticEmail && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold shrink-0">
                          Подключена
                        </span>
                      )}
                    </div>

                    {isSyntheticEmail && (
                      <form onSubmit={handleLinkEmail} className="space-y-2.5 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="email"
                            value={linkEmailInput}
                            onChange={(e) => setLinkEmailInput(e.target.value)}
                            placeholder="Ваш Gmail (name@gmail.com)"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                            required
                          />
                          <input
                            type="password"
                            value={linkPasswordInput}
                            onChange={(e) => setLinkPasswordInput(e.target.value)}
                            placeholder="Пароль (от 6 символов)"
                            minLength={6}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                            required
                          />
                        </div>

                        {linkEmailError && (
                          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                            {linkEmailError}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={linkingEmail}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-semibold transition"
                        >
                          {linkingEmail ? "Сохраняем..." : "Привязать почту"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200/90 px-5 py-4 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-neutral-800">Правовые документы (РУС / ҚАЗ)</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href="/offer" target="_blank" className="hover:text-neutral-950 underline">
                      Оферта
                    </Link>
                    <Link href="/terms" target="_blank" className="hover:text-neutral-950 underline">
                      Соглашение
                    </Link>
                    <Link href="/privacy" target="_blank" className="hover:text-neutral-950 underline">
                      Конфиденциальность
                    </Link>
                  </div>
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
                  О компании и бренд
                </h1>

                {/* Storefront Template Selector Card */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
                  <div>
                    <div className="font-semibold text-sm text-neutral-950">
                      Формат витрины
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Выберите внешний вид витрины под ваш тип бизнеса. Переключается мгновенно.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSelectStorefrontTemplate("shop")}
                      className={`text-left p-3.5 rounded-2xl border-2 transition ${
                        (business.storefront_template || "shop") === "shop"
                          ? "border-neutral-950 bg-neutral-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-neutral-950">
                          Магазин / Еда
                        </span>
                        {(business.storefront_template || "shop") === "shop" && (
                          <span className="px-2 py-0.5 rounded-full bg-neutral-950 text-white text-[10px] font-semibold">
                            Активен
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Сетка карточек с фото, корзина, самовывоз и доставка.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectStorefrontTemplate("services")}
                      className={`text-left p-3.5 rounded-2xl border-2 transition ${
                        business.storefront_template === "services"
                          ? "border-neutral-950 bg-neutral-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-neutral-950">
                          Услуги и запись
                        </span>
                        {business.storefront_template === "services" && (
                          <span className="px-2 py-0.5 rounded-full bg-neutral-950 text-white text-[10px] font-semibold">
                            Активен
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Чистый прайс-лист с длительностью и быстрой записью на дату и время.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Logo Upload Card (PWA App Icon & Short Name) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm text-neutral-950">
                        Иконка и имя приложения (PWA)
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Загрузите квадратный логотип (PNG или JPG, лучше 512×512 px) и укажите
                        короткое название — именно так ваше приложение будет выглядеть на главном
                        экране телефона клиента.
                      </p>
                    </div>

                    {/* Live App Icon Preview */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <div className="w-16 h-16 rounded-[18px] border border-slate-200 bg-neutral-950 overflow-hidden flex items-center justify-center shadow-sm">
                        {business.logo_url ? (
                          <img
                            src={business.logo_url}
                            alt="Логотип бизнеса"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-extrabold text-lg tracking-tight">
                            {(business.pwa_short_name || business.name || "TS")
                              .trim()
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-neutral-800 max-w-[76px] truncate text-center leading-tight">
                        {(business.pwa_short_name || "").trim() ||
                          business.name.slice(0, 12)}
                      </span>
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
                        accept="image/png,image/jpeg,image/webp"
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

                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-slate-600">
                        Короткое имя под иконкой на телефоне
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {(business.pwa_short_name || "").length}/12
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={12}
                        value={business.pwa_short_name || ""}
                        onChange={(e) =>
                          setBusiness({
                            ...business,
                            pwa_short_name: e.target.value.slice(0, 12),
                          })
                        }
                        placeholder="Например: MAKS"
                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={handleSavePwaShortName}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-900 text-xs font-semibold transition shrink-0"
                      >
                        Сохранить
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      До 12 символов, чтобы название не обрезалось на экране телефона (вместо «MAKS замена масла» — просто «MAKS»).
                    </p>
                  </div>
                </div>

                {/* Brand Color Picker Card */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-sm"
                        style={{ backgroundColor: business.brand_color || "#111827" }}
                      >
                        <Palette className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-neutral-950">
                          Цвет бренда на витрине
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Подбирается автоматически при загрузке логотипа или выбирается вручную — в этот цвет окрасятся кнопки и акценты вашей витрины.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {BRAND_COLOR_PRESETS.map((preset) => {
                      const active =
                        (business.brand_color || "#111827").toLowerCase() ===
                        preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => handleSaveBrandColor(preset.hex)}
                          title={preset.name}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition border-2 ${
                            active
                              ? "border-neutral-950 scale-110 shadow-sm"
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: preset.hex }}
                        >
                          {active && <Check className="w-4 h-4 text-white" />}
                        </button>
                      );
                    })}

                    {/* Custom color input */}
                    <label
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-neutral-800 cursor-pointer transition"
                      title="Выбрать свой оттенок"
                    >
                      <input
                        type="color"
                        value={business.brand_color || "#111827"}
                        onChange={(e) =>
                          setBusiness({ ...business, brand_color: e.target.value })
                        }
                        onBlur={(e) => handleSaveBrandColor(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span className="font-mono uppercase text-[11px]">
                        {business.brand_color || "#111827"}
                      </span>
                    </label>
                  </div>

                  {business.logo_url && (
                    <button
                      type="button"
                      onClick={handleAutoPickBrandColor}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-900 text-xs font-semibold transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Взять цвет из логотипа автоматически</span>
                    </button>
                  )}
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

                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Юридические реквизиты продавца (видны клиентам в меню «О магазине»)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Повышает доверие покупателей и соответствует требованиям Закона РК «О защите прав потребителей».
                      </p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Наименование ИП / ТОО
                        </label>
                        <input
                          type="text"
                          value={business.legal_name || ""}
                          onChange={(e) =>
                            setBusiness({ ...business, legal_name: e.target.value })
                          }
                          placeholder="ИП «Иванов» или ТОО «Альфа»"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          ИИН / БИН (12 цифр)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={12}
                          value={business.bin_iin || ""}
                          onChange={(e) =>
                            setBusiness({
                              ...business,
                              bin_iin: e.target.value.replace(/\D/g, "").slice(0, 12),
                            })
                          }
                          placeholder="123456789012"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                        />
                      </div>
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
              <form onSubmit={handleSavePaymentSettings} className="space-y-4 max-w-2xl">
                <div>
                  <h1 className="text-2xl font-bold text-neutral-950">
                    Подключение оплаты
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Подключите удобные способы оплаты — клиенты увидят их прямо в корзине и при записи.
                  </p>
                </div>

                {/* Why Online API Payments Banner */}
                <div className="rounded-3xl bg-gradient-to-br from-neutral-950 to-slate-900 text-white p-5 shadow-sm space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Почему онлайн-оплата (Halyk ePay / Freedom Pay) удобнее</span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2.5 text-xs text-white/85">
                    <div className="bg-white/[0.07] rounded-2xl p-3">
                      <div className="font-semibold text-white mb-0.5">Оплата в 1 клик</div>
                      Клиент платит картой любого банка, Apple Pay или Google Pay прямо на витрине.
                    </div>
                    <div className="bg-white/[0.07] rounded-2xl p-3">
                      <div className="font-semibold text-white mb-0.5">Без проверки чеков</div>
                      Банк сам мгновенно подтверждает оплату — заказ сразу приходит в Telegram со статусом «Оплачено».
                    </div>
                    <div className="bg-white/[0.07] rounded-2xl p-3">
                      <div className="font-semibold text-white mb-0.5">0% от TIYIN</div>
                      Деньги поступают напрямую на ваш счёт ИП/ТОО в банке по вашему тарифу эквайринга.
                    </div>
                  </div>
                  <div className="text-[11px] text-white/70 pt-1 border-t border-white/10 leading-relaxed">
                    Безопасность: TIYIN не хранит данные карт покупателей и не удерживает ваши деньги. API-ключи шифруются на сервере (AES-256-GCM) — используйте ключи <strong>только для приёма платежей</strong> (без прав вывода).
                  </div>
                </div>

                {/* 1. KASPI PAY */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-[#F14635] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                        K
                      </span>
                      <div>
                        <div className="font-bold text-neutral-950">Kaspi Pay (ссылка QR)</div>
                        <div className="text-xs text-slate-500">
                          Клиент переходит по ссылке, оплачивает и прикрепляет чек прямо на сайте
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
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
                      В целях безопасности клиент не сможет перейти к оплате Kaspi Pay, пока не укажет свой номер телефона. Загруженный чек автоматически придёт вам в «Заказы» и в Telegram.
                    </p>
                  </div>
                </div>

                {/* PRO GATE BANNER FOR BANK APIS */}
                {!hasActiveProAccess(business) && (
                  <div className="rounded-3xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-amber-950">
                        API банков (Halyk ePay и Freedom Pay) — функция тарифа «Бизнес PRO»
                      </div>
                      <div className="text-[11px] text-amber-900/85">
                        На «Базовом» тарифе (990 ₸) доступен Kaspi Pay по ссылке. Включите PRO (1 месяц бесплатно), чтобы принимать карты и Apple/Google Pay автоматически.
                      </div>
                    </div>
                    {canActivateFreeProTrial(business) && (
                      <button
                        type="button"
                        disabled={activatingPro}
                        onClick={handleActivateProTrial}
                        className="px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold shrink-0 transition disabled:opacity-50"
                      >
                        {activatingPro ? "Включаем..." : "Включить PRO (1 мес. 0 ₸)"}
                      </button>
                    )}
                  </div>
                )}

                {/* 2. HALYK EPAY API */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-[#00805F] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                        H
                      </span>
                      <div>
                        <div className="font-bold text-neutral-950">Halyk ePay (Онлайн-оплата API)</div>
                        <div className="text-xs text-slate-500">
                          Автоматический приём карт Visa/Mastercard, Apple Pay, Google Pay
                        </div>
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                      <span className="text-xs font-semibold text-slate-600">
                        {halykApiEnabled ? "Вкл" : "Выкл"}
                      </span>
                      <input
                        type="checkbox"
                        checked={halykApiEnabled}
                        onChange={(e) => setHalykApiEnabled(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 accent-[#00805F]"
                      />
                    </label>
                  </div>

                  {/* Test / Production mode toggle */}
                  <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-2xl px-3.5 py-2.5 border border-slate-200/70">
                    <div>
                      <div className="text-xs font-semibold text-neutral-900">
                        Режим работы Halyk ePay
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {halykTestMode
                          ? "Тестовый режим (для проверки ключей перед запуском)"
                          : "Боевой режим (принимаются реальные платежи)"}
                      </div>
                    </div>
                    <div className="inline-flex p-0.5 rounded-xl bg-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setHalykTestMode(true)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                          halykTestMode
                            ? "bg-white text-neutral-950 shadow-sm"
                            : "text-slate-600"
                        }`}
                      >
                        Тест
                      </button>
                      <button
                        type="button"
                        onClick={() => setHalykTestMode(false)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                          !halykTestMode
                            ? "bg-[#00805F] text-white shadow-sm"
                            : "text-slate-600"
                        }`}
                      >
                        Боевой
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Client ID
                      </label>
                      <input
                        type="text"
                        value={halykClientId}
                        onChange={(e) => setHalykClientId(e.target.value)}
                        placeholder="Например: myshop_client"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Terminal ID
                      </label>
                      <input
                        type="text"
                        value={halykTerminalId}
                        onChange={(e) => setHalykTerminalId(e.target.value)}
                        placeholder="Например: 67e34d63-..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-600">
                        Client Secret (API ключ)
                      </label>
                      {halykHasSecret && (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Ключ сохранён (защищён)
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      value={halykClientSecret}
                      onChange={(e) => setHalykClientSecret(e.target.value)}
                      placeholder={
                        halykHasSecret
                          ? "Оставьте пустым, чтобы не менять сохранённый ключ"
                          : "Вставьте Client Secret от Halyk Bank"
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>

                  {/* Collapsible guide for Halyk */}
                  <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowHalykGuide((prev) => !prev)}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-emerald-900"
                    >
                      <span>Как получить API ключи в Halyk Bank (3 шага)</span>
                      {showHalykGuide ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    {showHalykGuide && (
                      <div className="px-3.5 pb-3.5 text-[11px] text-emerald-950 space-y-1.5 leading-relaxed border-t border-emerald-200/50 pt-2.5">
                        <div>
                          1. Откройте приложение <strong>Onlinebank</strong> (Halyk для бизнеса) → раздел <strong>«Интернет-эквайринг / ePay»</strong> и подайте заявку на подключение онлайн-оплаты для сайта <span className="font-mono">tiyin.kz/{business.slug}</span>.
                        </div>
                        <div>
                          2. После одобрения банк пришлёт на почту 3 параметра: <strong>Client ID</strong>, <strong>Client Secret</strong> и <strong>Terminal ID</strong> (сначала тестовые, затем боевые).
                        </div>
                        <div>
                          3. Вставьте их в поля выше, включите переключатель Halyk ePay и нажмите <strong>Сохранить</strong>. Всё остальное (получение токена, окно оплаты и мгновенное подтверждение в Telegram) TIYIN сделает сам.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. FREEDOM PAY API */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-[#00B140] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                        F
                      </span>
                      <div>
                        <div className="font-bold text-neutral-950">Freedom Pay (Freedom Bank API)</div>
                        <div className="text-xs text-slate-500">
                          Приём карт всех банков РК, Apple Pay, Google Pay, Freedom рассрочка
                        </div>
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                      <span className="text-xs font-semibold text-slate-600">
                        {freedomApiEnabled ? "Вкл" : "Выкл"}
                      </span>
                      <input
                        type="checkbox"
                        checked={freedomApiEnabled}
                        onChange={(e) => setFreedomApiEnabled(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 accent-[#00B140]"
                      />
                    </label>
                  </div>

                  {/* Test / Production mode toggle */}
                  <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-2xl px-3.5 py-2.5 border border-slate-200/70">
                    <div>
                      <div className="text-xs font-semibold text-neutral-900">
                        Режим работы Freedom Pay
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {freedomTestMode
                          ? "Тестовый режим (pg_testing_mode = 1)"
                          : "Боевой режим (принимаются реальные платежи)"}
                      </div>
                    </div>
                    <div className="inline-flex p-0.5 rounded-xl bg-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setFreedomTestMode(true)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                          freedomTestMode
                            ? "bg-white text-neutral-950 shadow-sm"
                            : "text-slate-600"
                        }`}
                      >
                        Тест
                      </button>
                      <button
                        type="button"
                        onClick={() => setFreedomTestMode(false)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                          !freedomTestMode
                            ? "bg-[#00B140] text-white shadow-sm"
                            : "text-slate-600"
                        }`}
                      >
                        Боевой
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Merchant ID (ID магазина)
                      </label>
                      <input
                        type="text"
                        value={freedomMerchantId}
                        onChange={(e) => setFreedomMerchantId(e.target.value)}
                        placeholder="Например: 551234"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-slate-600">
                          Secret Key (для приёма)
                        </label>
                        {freedomHasSecret && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Сохранён
                          </span>
                        )}
                      </div>
                      <input
                        type="password"
                        value={freedomSecretKey}
                        onChange={(e) => setFreedomSecretKey(e.target.value)}
                        placeholder={
                          freedomHasSecret
                            ? "Оставьте пустым, чтобы не менять"
                            : "Секретный ключ магазина"
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                  </div>

                  {/* Collapsible guide for Freedom Pay */}
                  <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowFreedomGuide((prev) => !prev)}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-emerald-900"
                    >
                      <span>Как получить API ключи в Freedom Bank / Freedom Pay (3 шага)</span>
                      {showFreedomGuide ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    {showFreedomGuide && (
                      <div className="px-3.5 pb-3.5 text-[11px] text-emerald-950 space-y-1.5 leading-relaxed border-t border-emerald-200/50 pt-2.5">
                        <div>
                          1. Оставьте заявку на сайте <strong>freedompay.kz</strong> (для ИП или ТОО), укажите адрес витрины <span className="font-mono">https://tiyin.kz/{business.slug}</span>.
                        </div>
                        <div>
                          2. После подписания договора войдите в личный кабинет Freedom Pay → <strong>«Настройки магазина»</strong> и скопируйте <strong>ID магазина (Merchant ID)</strong> и <strong>Секретный ключ для приёма платежей (Secret Key)</strong>.
                        </div>
                        <div>
                          3. Вставьте их выше, включите Freedom Pay и нажмите <strong>Сохранить</strong>. Подтверждение оплаты и отправка заказа в Telegram сработают автоматически.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {paymentSaveError && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                    {paymentSaveError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingPayments}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {savingPayments ? "Сохраняем..." : "Сохранить настройки оплаты"}
                </button>
              </form>
            )}

            {/* SUB-SECTION: YANDEX DELIVERY (BYOK) */}
            {settingsSection === "delivery" && (
              <YandexDeliverySettings
                accessToken={accessToken}
                business={business}
                onBusinessUpdate={(patch) =>
                  setBusiness((prev) => (prev ? { ...prev, ...patch } : prev))
                }
                onNotice={showNotice}
                onActivateProTrial={handleActivateProTrial}
                activatingPro={activatingPro}
              />
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

      {/* RECEIPT PREVIEW MODAL */}
      {previewReceiptOrder && previewReceiptOrder.receipt_url && (
        <div
          onClick={() => setPreviewReceiptOrder(null)}
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div>
                <div className="font-bold text-base text-neutral-950">
                  Чек Kaspi — {previewReceiptOrder.order_code}
                </div>
                <div className="text-xs text-slate-500">
                  {previewReceiptOrder.client_name} • {previewReceiptOrder.client_phone} •{" "}
                  <strong>{formatKZT(previewReceiptOrder.total_price)}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceiptOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex items-center justify-center">
              {previewReceiptOrder.receipt_url.toLowerCase().includes(".pdf") ? (
                <div className="text-center space-y-3 py-8">
                  <FileText className="w-12 h-12 text-red-500 mx-auto" />
                  <div className="text-sm font-semibold text-neutral-900">
                    Чек загружен в формате PDF
                  </div>
                  <a
                    href={previewReceiptOrder.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-xs font-semibold hover:bg-neutral-800 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Открыть PDF-чек
                  </a>
                </div>
              ) : (
                <img
                  src={previewReceiptOrder.receipt_url}
                  alt={`Чек ${previewReceiptOrder.order_code}`}
                  className="max-h-[60vh] w-auto rounded-2xl border border-slate-200 shadow-sm object-contain"
                />
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 shrink-0">
              <a
                href={previewReceiptOrder.receipt_url}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-900 text-xs font-semibold transition"
              >
                <Download className="w-4 h-4" />
                Сохранить чек
              </a>

              {previewReceiptOrder.payment_status !== "paid" ? (
                <button
                  type="button"
                  onClick={() =>
                    updateOrderPaymentStatus(previewReceiptOrder.id, "paid")
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  Подтвердить оплату
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Оплата подтверждена
                </span>
              )}
            </div>
          </div>
        </div>
      )}

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
