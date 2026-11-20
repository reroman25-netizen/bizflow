"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  QrCode,
  Settings,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Bot,
  Menu,
  X,
} from "lucide-react";
import { loadPlatformData, savePlatformData, formatKZT } from "@/lib/storage";
import { PlatformData, OrderStatus, Product } from "@/lib/types";

type TabId = "overview" | "products" | "orders" | "clients" | "share" | "settings";

export default function DashboardPage() {
  const [data, setData] = useState<PlatformData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://your-site.vercel.app");

  // New product form
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("Выпечка");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    setData(loadPlatformData());
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const updateData = (next: PlatformData) => {
    setData(next);
    savePlatformData(next);
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Загрузка кабинета...
      </div>
    );
  }

  const publicUrl = `${origin}/${data.business.slug}`;
  const totalRevenue = data.orders.reduce((sum, o) => sum + o.totalPrice, 0);
  const newOrdersCount = data.orders.filter((o) => o.status === "new").length;

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseInt(newPrice, 10);
    if (!newName.trim() || isNaN(priceNum) || priceNum <= 0) return;

    const item: Product = {
      id: "p-" + Date.now(),
      name: newName.trim(),
      description: newDesc.trim() || "Свежее приготовление под заказ",
      price: priceNum,
      category: newCategory.trim() || "Основное",
      isAvailable: true,
    };

    updateData({
      ...data,
      products: [item, ...data.products],
    });
    setNewName("");
    setNewPrice("");
    setNewDesc("");
  };

  const toggleProduct = (id: string) => {
    updateData({
      ...data,
      products: data.products.map((p) =>
        p.id === id ? { ...p, isAvailable: !p.isAvailable } : p
      ),
    });
  };

  const deleteProduct = (id: string) => {
    updateData({
      ...data,
      products: data.products.filter((p) => p.id !== id),
    });
  };

  const updateOrderStatus = (id: string, status: OrderStatus) => {
    updateData({
      ...data,
      orders: data.orders.map((o) => (o.id === id ? { ...o, status } : o)),
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "overview", label: "Обзор", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "products", label: "Услуги и товары", icon: <Package className="w-4 h-4" /> },
    {
      id: "orders",
      label: "Заказы",
      icon: <ShoppingBag className="w-4 h-4" />,
      badge: newOrdersCount > 0 ? newOrdersCount : undefined,
    },
    { id: "clients", label: "База клиентов", icon: <Users className="w-4 h-4" /> },
    { id: "share", label: "Ссылка и QR", icon: <QrCode className="w-4 h-4" /> },
    { id: "settings", label: "Настройки ИИ", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between sticky top-0 z-30">
        <div className="font-bold text-slate-900 truncate">{data.business.name}</div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${data.business.slug}`}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium"
          >
            Витрина
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } md:flex md:flex-col w-full md:w-64 bg-white border-r border-slate-200 md:min-h-screen p-4 justify-between`}
      >
        <div>
          <div className="hidden md:flex items-center gap-2.5 px-2 py-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center">
              B
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-900 truncate">
                {data.business.name}
              </div>
              <div className="text-xs text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Кабинет активен
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
                    ? "bg-blue-50 text-blue-700"
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
            href={`/${data.business.slug}`}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
          >
            <ExternalLink className="w-4 h-4" />
            Открыть витрину
          </Link>
          <Link
            href="/"
            className="block text-center text-xs text-slate-500 hover:text-slate-800 py-1"
          >
            На главную платформу
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 max-w-5xl w-full mx-auto">
        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Сводка бизнеса</h1>
                <p className="text-sm text-slate-500">
                  Все заказы с витрины и чата попадают сюда в реальном времени
                </p>
              </div>
              <button
                onClick={() =>
                  updateData({
                    ...data,
                    business: { ...data.business, aiEnabled: !data.business.aiEnabled },
                  })
                }
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition ${
                  data.business.aiEnabled
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-slate-100 border-slate-200 text-slate-600"
                }`}
              >
                <Bot className="w-4 h-4" />
                ИИ-агент: {data.business.aiEnabled ? "Включен 24/7" : "Выключен"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <div className="text-xs font-medium text-slate-500 mb-1">Общая выручка</div>
                <div className="text-2xl font-bold text-slate-900">
                  {formatKZT(totalRevenue)}
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <div className="text-xs font-medium text-slate-500 mb-1">Всего заказов</div>
                <div className="text-2xl font-bold text-slate-900">{data.orders.length}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <div className="text-xs font-medium text-slate-500 mb-1">Клиентов в базе</div>
                <div className="text-2xl font-bold text-slate-900">{data.clients.length}</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900">Последние заказы</h2>
                <button
                  onClick={() => setActiveTab("orders")}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Все заказы
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {data.orders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-medium text-sm text-slate-900">
                        {order.id} — {order.clientName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-slate-900">
                        {formatKZT(order.totalPrice)}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          order.status === "new"
                            ? "bg-blue-100 text-blue-700"
                            : order.status === "in_progress"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {order.status === "new"
                          ? "Новый"
                          : order.status === "in_progress"
                          ? "В работе"
                          : "Готов"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {activeTab === "products" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Услуги и товары</h1>
              <p className="text-sm text-slate-500">
                Изменения сразу появляются на витрине клиента и в знаниях ИИ-агента
              </p>
            </div>

            <form
              onSubmit={handleAddProduct}
              className="bg-white p-5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <input
                type="text"
                placeholder="Название (напр. Баурсаки)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
              <input
                type="number"
                placeholder="Цена в ₸"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
              <input
                type="text"
                placeholder="Категория"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
              <input
                type="text"
                placeholder="Краткое описание (необязательно)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="sm:col-span-2 lg:col-span-4 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
              {data.products.map((product) => (
                <div
                  key={product.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{product.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {product.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{product.description}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900">
                      {formatKZT(product.price)}
                    </span>
                    <button
                      onClick={() => toggleProduct(product.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                        product.isAvailable
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {product.isAvailable ? "В наличии" : "Скрыто"}
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="p-2 text-slate-400 hover:text-red-600 transition"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-slate-900">Заказы и заявки</h1>
            <div className="space-y-3">
              {data.orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{order.id}</span>
                      <span className="text-xs text-slate-400">{order.createdAt}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-medium">
                        {order.paymentMethod}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-slate-800">
                      {order.clientName} • {order.clientPhone}
                    </div>
                    <div className="text-xs text-slate-500">Адрес: {order.address}</div>
                    <div className="text-sm text-slate-700 pt-1">
                      {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                    <div className="text-lg font-bold text-slate-900">
                      {formatKZT(order.totalPrice)}
                    </div>
                    <select
                      value={order.status}
                      onChange={(e) =>
                        updateOrderStatus(order.id, e.target.value as OrderStatus)
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white"
                    >
                      <option value="new">Новый</option>
                      <option value="in_progress">В работе</option>
                      <option value="done">Готов / Выдан</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {activeTab === "clients" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">База клиентов</h1>
              <p className="text-sm text-slate-500">
                Пополняется автоматически по номеру телефона после каждого заказа
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
                    <th className="px-5 py-3">Последний визит</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.clients.map((client) => (
                    <tr key={client.id}>
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {client.name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{client.phone}</td>
                      <td className="px-5 py-3.5 text-slate-600">{client.ordersCount}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        {formatKZT(client.totalSpent)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">
                        {client.lastOrderAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SHARE & QR */}
        {activeTab === "share" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Ссылка и QR-код для клиентов
              </h1>
              <p className="text-sm text-slate-500">
                Отправляйте ссылку в WhatsApp / Instagram или распечатайте QR-код на стойку
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center gap-8">
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-900 shadow-sm">
                <QRCodeSVG value={publicUrl} size={180} />
              </div>

              <div className="flex-1 space-y-4 w-full">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">
                    Прямая ссылка на вашу витрину
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={publicUrl}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Скопировано" : "Копировать"}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Когда клиент переходит по этой ссылке, он видит <strong>только</strong>{" "}
                  вашу компанию, прайс и ИИ-ассистента — без чужих товаров и рекламы.
                </p>

                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Распечатать QR-код
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === "settings" && (
          <div className="space-y-5 max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-900">Настройки бизнеса и ИИ</h1>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Название бизнеса
                </label>
                <input
                  type="text"
                  value={data.business.name}
                  onChange={(e) =>
                    updateData({
                      ...data,
                      business: { ...data.business, name: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Номер Kaspi Pay (для выставления счетов)
                </label>
                <input
                  type="text"
                  value={data.business.kaspiPhone}
                  onChange={(e) =>
                    updateData({
                      ...data,
                      business: { ...data.business, kaspiPhone: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Инструкция для ИИ-агента (System Prompt)
                </label>
                <textarea
                  rows={4}
                  value={data.business.aiPrompt}
                  onChange={(e) =>
                    updateData({
                      ...data,
                      business: { ...data.business, aiPrompt: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <p className="text-xs text-emerald-600">
                Все изменения сохраняются автоматически.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
