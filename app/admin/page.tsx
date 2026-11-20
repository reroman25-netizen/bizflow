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
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Business, BusinessAiConfig, Product } from "@/lib/types";
import { formatKZT } from "@/lib/format";

interface AdminBusinessBundle {
  business: Business;
  aiConfig: BusinessAiConfig;
  products: Product[];
}

export default function AdminPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [bundles, setBundles] = useState<AdminBusinessBundle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // Quick add product by admin
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
      }),
    });
    if (res.ok) {
      setNotice("Данные бизнеса и настройки ИИ-агента сохранены.");
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Загрузка панели администратора...
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4">
          <Lock className="w-10 h-10 text-purple-600 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Нет прав доступа</h1>
          <p className="text-sm text-slate-500">{errorMsg}</p>
          <p className="text-xs text-slate-400">
            Убедитесь, что ваша почта указана в переменной <code>ADMIN_EMAIL</code> в
            настройках Vercel.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium"
          >
            На главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-purple-400" />
          <span className="font-bold">Супер-админка BizFlow</span>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          На сайт
        </Link>
      </header>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 grid md:grid-cols-12 gap-6">
        {/* Left: List of all businesses */}
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
                  <span className="font-bold text-slate-900 truncate">
                    {item.business.name}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      item.business.is_active ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  /{item.business.slug} • Товаров: {item.products.length}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Right: Manage Selected Business */}
        <div className="md:col-span-8 space-y-6">
          {notice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl">
              {notice}
            </div>
          )}

          {current ? (
            <>
              {/* Business Profile & Storefront Visibility */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
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

                <div className="grid sm:grid-cols-2 gap-3">
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
                </div>

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
                  Витрина опубликована и видна в поиске
                </label>
              </div>

              {/* Hidden AI Agent Configuration (ONLY ADMIN) */}
              <div className="bg-white p-6 rounded-2xl border-2 border-purple-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-600" />
                    Настройка ИИ-агента (скрыто от бизнеса)
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
                    Статус, который видит владелец бизнеса в своем кабинете
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
                    placeholder="Опишите роль, тон общения, правила продаж, ответы на частые вопросы..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <button
                  onClick={handleSaveBusinessAndAi}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition"
                >
                  <Save className="w-4 h-4" />
                  Сохранить изменения бизнеса и ИИ
                </button>
              </div>

              {/* Products Management by Admin */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
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
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium"
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
                        <span className="font-medium text-slate-900">{p.name}</span>{" "}
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
    </div>
  );
}
