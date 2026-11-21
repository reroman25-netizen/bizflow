"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Store,
  Bot,
  Package,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  ArrowLeft,
  Lock,
  Layers,
  Inbox,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  Business,
  BusinessAiConfig,
  BusinessChannelsAdmin,
  Product,
  SubscriptionRequest,
} from "@/lib/types";
import { formatDate, formatKZT } from "@/lib/format";
import { KZ_CITIES } from "@/lib/cities";
import { BUSINESS_CATEGORIES } from "@/lib/categories";

interface AdminBusinessBundle {
  business: Business;
  aiConfig: BusinessAiConfig;
  channels: BusinessChannelsAdmin;
  products: Product[];
}

interface AdminSubscriptionReq extends SubscriptionRequest {
  business_name: string;
  business_slug: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [adminView, setAdminView] = useState<"businesses" | "requests">("businesses");

  const [bundles, setBundles] = useState<AdminBusinessBundle[]>([]);
  const [requests, setRequests] = useState<AdminSubscriptionReq[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodCat, setProdCat] = useState("Услуги");

  const loadAll = useCallback(async (accessToken: string) => {
    setLoading(true);
    const res = await fetch("/api/admin/overview", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setErrorMsg(json.error || "Доступ запрещен");
      setLoading(false);
      return;
    }
    const json = await res.json();
    const list: AdminBusinessBundle[] = json.businesses || [];
    setBundles(list);
    setRequests(json.subscriptionRequests || []);
    if (list.length > 0) {
      setSelectedId((prev) => prev || list[0].business.id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth?mode=business&tab=login");
        return;
      }
      setToken(data.session.access_token);
      await loadAll(data.session.access_token);
    };
    init();
  }, [router, loadAll]);

  const current = bundles.find((b) => b.business.id === selectedId) || null;

  const updateCurrentLocal = (updater: (b: AdminBusinessBundle) => AdminBusinessBundle) => {
    if (!selectedId) return;
    setBundles((prev) =>
      prev.map((item) => (item.business.id === selectedId ? updater(item) : item))
    );
  };

  const handleSaveBusinessAndAi = async () => {
    if (!current || !token) return;
    const res = await fetch("/api/admin/business", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        business: current.business,
        aiConfig: current.aiConfig,
        channels: current.channels,
      }),
    });
    if (res.ok) {
      setNotice("Данные бизнеса, настройки TIYIN AI и каналы сохранены.");
      setTimeout(() => setNotice(""), 3000);
    }
  };

  const handleAdminAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !token) return;
    const priceNum = parseInt(prodPrice, 10);
    if (!prodName.trim() || isNaN(priceNum)) return;

    const res = await fetch("/api/admin/business", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "add_product",
        businessId: current.business.id,
        name: prodName.trim(),
        price: priceNum,
        category: prodCat.trim() || "Услуги",
      }),
    });
    if (res.ok) {
      const json = await res.json();
      updateCurrentLocal((item) => ({
        ...item,
        products: [json.product, ...item.products],
      }));
      setProdName("");
      setProdPrice("");
    }
  };

  const handleAdminDeleteProduct = async (productId: string) => {
    if (!current || !token) return;
    const res = await fetch("/api/admin/business", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "delete_product",
        productId,
      }),
    });
    if (res.ok) {
      updateCurrentLocal((item) => ({
        ...item,
        products: item.products.filter((p) => p.id !== productId),
      }));
    }
  };

  const handleUpdateRequestStatus = async (
    requestId: string,
    status: SubscriptionRequest["status"]
  ) => {
    if (!token) return;
    const res = await fetch("/api/admin/business", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "update_subscription_status",
        requestId,
        status,
      }),
    });
    if (res.ok) {
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status } : r))
      );
      setNotice("Статус заявки обновлен.");
      setTimeout(() => setNotice(""), 2500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Загрузка панели администратора...
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAFAFB]">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4">
          <Lock className="w-10 h-10 text-purple-600 mx-auto" />
          <h1 className="text-xl font-bold text-neutral-950">Нет прав доступа</h1>
          <p className="text-sm text-slate-500">{errorMsg}</p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-medium"
          >
            На главную
          </Link>
        </div>
      </div>
    );
  }

  const newReqCount = requests.filter((r) => r.status === "new").length;

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="bg-neutral-950 text-white px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-purple-400" />
          <span className="font-bold text-sm sm:text-base">Супер-админка TIYIN Space</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdminView("businesses")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              adminView === "businesses"
                ? "bg-white text-neutral-950"
                : "text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            Компании ({bundles.length})
          </button>
          <button
            type="button"
            onClick={() => setAdminView("requests")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              adminView === "requests"
                ? "bg-white text-neutral-950"
                : "text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Заявки
            {newReqCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px]">
                {newReqCount}
              </span>
            )}
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-neutral-300 hover:text-white ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">На сайт</span>
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {notice && (
          <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl">
            {notice}
          </div>
        )}

        {/* VIEW: SUBSCRIPTION REQUESTS */}
        {adminView === "requests" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-neutral-950">
              Заявки бизнесов на подключение TIYIN AI
            </h2>
            {requests.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
                Заявок из Конструктора подписки пока нет.
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-950">
                          {req.business_name}
                        </span>
                        <span className="text-xs text-slate-400">
                          /{req.business_slug} • {formatDate(req.created_at)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700">
                        Каналы:{" "}
                        <strong>
                          {Array.isArray(req.selected_channels)
                            ? req.selected_channels.join(", ")
                            : ""}
                        </strong>
                      </div>
                      <div className="text-xs text-slate-500">
                        Контакт: {req.contact_phone || "не указан"} • Срок запуска:{" "}
                        {req.estimated_days} дн.
                      </div>
                      {req.comment && (
                        <div className="text-xs text-slate-500">
                          Комментарий: {req.comment}
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                      <div className="text-lg font-bold text-neutral-950">
                        {formatKZT(req.monthly_price)}/мес
                      </div>
                      <select
                        value={req.status}
                        onChange={(e) =>
                          handleUpdateRequestStatus(
                            req.id,
                            e.target.value as SubscriptionRequest["status"]
                          )
                        }
                        className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                      >
                        <option value="new">Новая</option>
                        <option value="in_progress">В работе</option>
                        <option value="active">Активна</option>
                        <option value="rejected">Отклонена</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: BUSINESSES */}
        {adminView === "businesses" && (
          <div className="grid md:grid-cols-12 gap-6">
            <div className="md:col-span-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">
                Все компании ({bundles.length})
              </div>
              {bundles.length === 0 ? (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 text-sm text-slate-500">
                  Пока нет зарегистрированных бизнесов.
                </div>
              ) : (
                bundles.map((item) => (
                  <button
                    key={item.business.id}
                    onClick={() => setSelectedId(item.business.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition ${
                      selectedId === item.business.id
                        ? "bg-white border-purple-500 ring-2 ring-purple-500/15"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-neutral-950 truncate">
                        {item.business.name}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          item.business.is_active ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {item.business.category || "Бизнес"} • {item.business.city || "Алматы"}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      /{item.business.slug} • Товаров: {item.products.length}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="md:col-span-8 space-y-6">
              {current ? (
                <>
                  {/* Business profile */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-bold text-lg text-neutral-950 flex items-center gap-2">
                        <Store className="w-5 h-5 text-blue-600" />
                        Кабинет и витрина бизнеса
                      </h2>
                      <Link
                        href={`/${current.business.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Открыть витрину
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Название
                        </label>
                        <input
                          type="text"
                          value={current.business.name}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              business: { ...item.business, name: e.target.value },
                            }))
                          }
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Сфера деятельности
                        </label>
                        <select
                          value={current.business.category || BUSINESS_CATEGORIES[0]}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              business: { ...item.business, category: e.target.value },
                            }))
                          }
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
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
                          Город
                        </label>
                        <select
                          value={current.business.city || "Алматы"}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              business: { ...item.business, city: e.target.value },
                            }))
                          }
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                        >
                          {KZ_CITIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Слоган
                        </label>
                        <input
                          type="text"
                          value={current.business.tagline}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              business: { ...item.business, tagline: e.target.value },
                            }))
                          }
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Ссылка Kaspi Pay QR
                        </label>
                        <input
                          type="text"
                          value={current.business.kaspi_pay_link || ""}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              business: {
                                ...item.business,
                                kaspi_pay_link: e.target.value,
                              },
                            }))
                          }
                          placeholder="https://pay.kaspi.kz/pay/..."
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-5">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={current.business.is_active}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              business: { ...item.business, is_active: e.target.checked },
                            }))
                          }
                          className="rounded border-slate-300"
                        />
                        Витрина опубликована в поиске
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(current.business.halyk_enabled)}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              business: {
                                ...item.business,
                                halyk_enabled: e.target.checked,
                              },
                            }))
                          }
                          className="rounded border-slate-300"
                        />
                        Значок Halyk Bank активен
                      </label>
                    </div>
                  </div>

                  {/* TIYIN AI Prompt Config */}
                  <div className="bg-white p-6 rounded-2xl border-2 border-purple-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-bold text-lg text-neutral-950 flex items-center gap-2">
                        <Bot className="w-5 h-5 text-purple-600" />
                        Настройка TIYIN AI (скрыто от бизнеса)
                      </h2>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-purple-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={current.aiConfig.ai_enabled}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              aiConfig: { ...item.aiConfig, ai_enabled: e.target.checked },
                            }))
                          }
                        />
                        ИИ-агент включен
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Статус в кабинете бизнеса
                      </label>
                      <input
                        type="text"
                        value={current.aiConfig.status_label}
                        onChange={(e) =>
                          updateCurrentLocal((item) => ({
                            ...item,
                            aiConfig: { ...item.aiConfig, status_label: e.target.value },
                          }))
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Системный промпт ИИ-агента (System Prompt)
                      </label>
                      <textarea
                        rows={5}
                        value={current.aiConfig.system_prompt}
                        onChange={(e) =>
                          updateCurrentLocal((item) => ({
                            ...item,
                            aiConfig: { ...item.aiConfig, system_prompt: e.target.value },
                          }))
                        }
                        placeholder="Опишите роль, тон общения, правила продаж..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>

                    {current.aiConfig.daily_notes && (
                      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                        <strong>Заметки владельца на сегодня:</strong>{" "}
                        {current.aiConfig.daily_notes}
                      </div>
                    )}
                  </div>

                  {/* Channels & Integrations Module Control */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                    <h2 className="font-bold text-lg text-neutral-950 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-emerald-600" />
                      Модули каналов и ключи интеграций
                    </h2>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(
                        [
                          { key: "web_enabled", label: "Витрина" },
                          { key: "whatsapp_enabled", label: "WhatsApp" },
                          { key: "instagram_enabled", label: "Instagram" },
                          { key: "telegram_enabled", label: "Telegram-бот" },
                        ] as const
                      ).map((ch) => (
                        <label
                          key={ch.key}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            current.channels[ch.key]
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                              : "bg-slate-50 border-slate-200 text-slate-500"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(current.channels[ch.key])}
                            onChange={(e) =>
                              updateCurrentLocal((item) => ({
                                ...item,
                                channels: {
                                  ...item.channels,
                                  [ch.key]: e.target.checked,
                                },
                              }))
                            }
                          />
                          {ch.label}
                        </label>
                      ))}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Telegram Chat ID владельца (уведомления)
                        </label>
                        <input
                          type="text"
                          value={current.channels.owner_telegram_chat_id || ""}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              channels: {
                                ...item.channels,
                                owner_telegram_chat_id: e.target.value,
                              },
                            }))
                          }
                          placeholder="512345678"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Telegram Bot Token (клиентский бот)
                        </label>
                        <input
                          type="text"
                          value={current.channels.telegram_bot_token || ""}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              channels: {
                                ...item.channels,
                                telegram_bot_token: e.target.value,
                              },
                            }))
                          }
                          placeholder="123456:ABC-DEF..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          WhatsApp Green-API Instance ID
                        </label>
                        <input
                          type="text"
                          value={current.channels.whatsapp_instance_id || ""}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              channels: {
                                ...item.channels,
                                whatsapp_instance_id: e.target.value,
                              },
                            }))
                          }
                          placeholder="1101234567"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          WhatsApp Green-API Token
                        </label>
                        <input
                          type="text"
                          value={current.channels.whatsapp_api_token || ""}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              channels: {
                                ...item.channels,
                                whatsapp_api_token: e.target.value,
                              },
                            }))
                          }
                          placeholder="token..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Instagram Page ID
                        </label>
                        <input
                          type="text"
                          value={current.channels.instagram_page_id || ""}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              channels: {
                                ...item.channels,
                                instagram_page_id: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Instagram Access Token
                        </label>
                        <input
                          type="text"
                          value={current.channels.instagram_access_token || ""}
                          onChange={(e) =>
                            updateCurrentLocal((item) => ({
                              ...item,
                              channels: {
                                ...item.channels,
                                instagram_access_token: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSaveBusinessAndAi}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition"
                    >
                      <Save className="w-4 h-4" />
                      Сохранить всё (бизнес, ИИ и каналы)
                    </button>
                  </div>

                  {/* Products */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                    <h2 className="font-bold text-lg text-neutral-950 flex items-center gap-2">
                      <Package className="w-5 h-5 text-slate-700" />
                      Товары и услуги на витрине ({current.products.length})
                    </h2>

                    <form
                      onSubmit={handleAdminAddProduct}
                      className="grid sm:grid-cols-4 gap-2"
                    >
                      <input
                        type="text"
                        placeholder="Название"
                        value={prodName}
                        onChange={(e) => setProdName(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Цена ₸"
                        value={prodPrice}
                        onChange={(e) => setProdPrice(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Категория"
                        value={prodCat}
                        onChange={(e) => setProdCat(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-neutral-950 text-white text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Добавить
                      </button>
                    </form>

                    <div className="divide-y divide-slate-100">
                      {current.products.map((p) => (
                        <div
                          key={p.id}
                          className="py-2.5 flex items-center justify-between gap-3 text-sm"
                        >
                          <div>
                            <span className="font-medium text-neutral-950">{p.name}</span>{" "}
                            <span className="text-xs text-slate-400">({p.category})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">{formatKZT(p.price)}</span>
                            <button
                              onClick={() => handleAdminDeleteProduct(p.id)}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
                  Выберите компанию слева для управления.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
