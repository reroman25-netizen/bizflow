"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Sparkles,
  MessageSquare,
  Sliders,
  Layers,
  Pause,
  Play,
  Save,
  Send,
  Lock,
  Check,
  RefreshCw,
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  Business,
  BusinessChannelsPublic,
  ChatMessageRecord,
  Conversation,
  Order,
  SubscriptionRequest,
} from "@/lib/types";
import { formatDate, formatKZT } from "@/lib/format";
import {
  ALL_IN_DISCOUNT_PERCENT,
  SUBSCRIPTION_MODULES,
  SubscriptionChannelId,
  calculateSubscription,
} from "@/lib/subscriptionPlans";

interface TiyinAiCenterProps {
  accessToken: string;
  business: Business;
  orders: Order[];
}

type SubTab = "dialogs" | "settings" | "subscription";

const CHANNEL_BADGE: Record<string, { label: string; className: string }> = {
  web: { label: "Витрина", className: "bg-slate-100 text-slate-700" },
  whatsapp: { label: "WhatsApp", className: "bg-emerald-50 text-emerald-700" },
  instagram: { label: "Instagram", className: "bg-pink-50 text-pink-700" },
  telegram: { label: "Telegram", className: "bg-sky-50 text-sky-700" },
};

const TAG_BADGE: Record<string, { label: string; className: string }> = {
  consultation: { label: "Консультация", className: "bg-slate-100 text-slate-600" },
  hot: { label: "Горячий", className: "bg-amber-50 text-amber-700" },
  needs_human: { label: "Нужен менеджер", className: "bg-red-50 text-red-700" },
  ordered: { label: "Заказ оформлен", className: "bg-emerald-50 text-emerald-700" },
};

const REQ_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  new: { label: "Новая заявка", className: "bg-blue-50 text-blue-700" },
  in_progress: { label: "Настраивается", className: "bg-amber-50 text-amber-700" },
  active: { label: "Активна", className: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Отклонена", className: "bg-slate-100 text-slate-500" },
};

export function TiyinAiCenter({ accessToken, business, orders }: TiyinAiCenterProps) {
  const [subTab, setSubTab] = useState<SubTab>("dialogs");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [aiEnabled, setAiEnabled] = useState(true);
  const [statusLabel, setStatusLabel] = useState("Настраивается администратором");
  const [dailyNotes, setDailyNotes] = useState("");
  const [channels, setChannels] = useState<BusinessChannelsPublic>({
    business_id: business.id,
    web_enabled: true,
    whatsapp_enabled: false,
    instagram_enabled: false,
    telegram_enabled: false,
    owner_telegram_chat_id: "",
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [subscriptionRequests, setSubscriptionRequests] = useState<SubscriptionRequest[]>([]);
  const [selectedModules, setSelectedModules] = useState<SubscriptionChannelId[]>([
    "whatsapp",
  ]);
  const [subContactPhone, setSubContactPhone] = useState(
    business.whatsapp || business.phone || ""
  );
  const [subComment, setSubComment] = useState("");
  const [sendingReq, setSendingReq] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadCenter = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await fetch("/api/dashboard/ai-center", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const json = await res.json();
          setAiEnabled(Boolean(json.aiConfig?.ai_enabled));
          setStatusLabel(json.aiConfig?.status_label || "Настраивается администратором");
          setDailyNotes(json.aiConfig?.daily_notes || "");
          if (json.channels) setChannels(json.channels);
          const convs: Conversation[] = json.conversations || [];
          setConversations(convs);
          setSubscriptionRequests(json.subscriptionRequests || []);
          if (convs.length > 0) {
            setSelectedConvId((prev) => prev || convs[0].id);
          }
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (accessToken) {
      loadCenter();
    }
  }, [accessToken, loadCenter]);

  const loadMessages = useCallback(
    async (convId: string) => {
      setLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/dashboard/ai-center?conversationId=${encodeURIComponent(convId)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (res.ok) {
          const json = await res.json();
          setMessages(json.messages || []);
        }
      } finally {
        setLoadingMessages(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (selectedConvId && accessToken) {
      loadMessages(selectedConvId);
    } else {
      setMessages([]);
    }
  }, [selectedConvId, accessToken, loadMessages]);

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  };

  const handleTogglePause = async (conv: Conversation) => {
    const nextPaused = !conv.ai_paused;
    const res = await fetch("/api/dashboard/ai-center", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        conversationId: conv.id,
        aiPaused: nextPaused,
      }),
    });
    if (res.ok) {
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, ai_paused: nextPaused } : c))
      );
      showToast(
        nextPaused
          ? "ИИ поставлен на паузу в этом диалоге. Вы можете общаться с клиентом лично."
          : "ИИ-агент снова активен в этом диалоге."
      );
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/dashboard/ai-center", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dailyNotes,
          ownerTelegramChatId: channels.owner_telegram_chat_id,
        }),
      });
      if (res.ok) {
        showToast("Настройки TIYIN AI и Telegram-уведомления сохранены.");
      } else {
        setErrorMsg("Не удалось сохранить настройки.");
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleModule = (id: SubscriptionChannelId) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmitSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedModules.length === 0) {
      setErrorMsg("Выберите хотя бы один канал для подключения.");
      return;
    }
    setSendingReq(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/subscription-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          channels: selectedModules,
          contactPhone: subContactPhone,
          comment: subComment,
        }),
      });
      const json = await res.json();
      if (res.ok && json.request) {
        setSubscriptionRequests((prev) => [json.request, ...prev]);
        setSubComment("");
        showToast(
          "Заявка отправлена! Менеджер TIYIN Space свяжется с вами для запуска автопилота."
        );
      } else {
        setErrorMsg(json.error || "Ошибка отправки заявки.");
      }
    } finally {
      setSendingReq(false);
    }
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId) || null;
  const calc = calculateSubscription(selectedModules);

  const nonCancelledOrders = orders.filter((o) => o.status !== "cancelled");
  const totalRevenue = nonCancelledOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const needsHumanCount = conversations.filter((c) => c.tag === "needs_human").length;

  const channelPills = [
    { key: "web", label: "Витрина", active: channels.web_enabled },
    { key: "whatsapp", label: "WhatsApp", active: channels.whatsapp_enabled },
    { key: "instagram", label: "Instagram", active: channels.instagram_enabled },
    { key: "telegram", label: "Telegram", active: channels.telegram_enabled },
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Загрузка центра TIYIN AI...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-neutral-950 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </span>
            <h1 className="text-2xl font-bold text-neutral-950">TIYIN AI</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                aiEnabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {aiEnabled ? "Автопилот активен" : "На паузе"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Единый центр управления ИИ-агентами, диалогами и подпиской по каналам
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadCenter(true)}
          disabled={refreshing}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Заказы через платформу</div>
          <div className="text-xl font-bold text-neutral-950 mt-1">
            {formatKZT(totalRevenue)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Всего заказов: {nonCancelledOrders.length}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Диалоги агента</div>
          <div className="text-xl font-bold text-neutral-950 mt-1">
            {conversations.length}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {needsHumanCount > 0 ? (
              <span className="text-red-600 font-medium">
                Требуют менеджера: {needsHumanCount}
              </span>
            ) : (
              "Все обработаны автономно"
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 mb-2">
            Статус каналов
          </div>
          <div className="flex flex-wrap gap-1.5">
            {channelPills.map((ch) => (
              <span
                key={ch.key}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                  ch.active
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200/70"
                    : "bg-slate-50 text-slate-400 border border-slate-200/70"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    ch.active ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
                {ch.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-navigation inside TIYIN AI */}
      <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setSubTab("dialogs")}
          className={`flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            subTab === "dialogs"
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-slate-600 hover:text-neutral-900"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Диалоги ({conversations.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab("settings")}
          className={`flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            subTab === "settings"
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-slate-600 hover:text-neutral-900"
          }`}
        >
          <Sliders className="w-4 h-4" />
          Заметки и Telegram
        </button>

        <button
          type="button"
          onClick={() => setSubTab("subscription")}
          className={`flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            subTab === "subscription"
              ? "bg-neutral-950 text-white shadow-sm"
              : "text-slate-600 hover:text-neutral-900"
          }`}
        >
          <Layers className="w-4 h-4" />
          Подключить каналы
        </button>
      </div>

      {/* SUBTAB 1: DIALOGS */}
      {subTab === "dialogs" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Conversation list */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Последние обращения
            </div>
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Диалогов пока нет. Как только клиент напишет ИИ на витрине или в
                подключенных мессенджерах, переписка появится здесь.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {conversations.map((conv) => {
                  const ch = CHANNEL_BADGE[conv.channel] || CHANNEL_BADGE.web;
                  const tg = TAG_BADGE[conv.tag] || TAG_BADGE.consultation;
                  const active = selectedConvId === conv.id;
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`w-full text-left p-3.5 transition ${
                        active ? "bg-slate-50" : "hover:bg-slate-50/70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-neutral-950 truncate">
                          {conv.client_name || "Гость"}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {formatDate(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${ch.className}`}
                        >
                          {ch.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${tg.className}`}
                        >
                          {tg.label}
                        </span>
                        {conv.ai_paused && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-800">
                            Пауза ИИ
                          </span>
                        )}
                      </div>
                      {conv.summary && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-1.5">
                          {conv.summary}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chat viewer */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 flex flex-col min-h-[420px] max-h-[540px] overflow-hidden">
            {selectedConv ? (
              <>
                <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-neutral-950 truncate">
                      {selectedConv.client_name || "Гость"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {selectedConv.client_phone || selectedConv.external_user_id}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePause(selectedConv)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      selectedConv.ai_paused
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-amber-100 hover:bg-amber-200 text-amber-900"
                    }`}
                  >
                    {selectedConv.ai_paused ? (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Включить ИИ
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        Пауза ИИ (взять на себя)
                      </>
                    )}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#FAFAFB]">
                  {loadingMessages ? (
                    <div className="text-center text-xs text-slate-400 py-8">
                      Загрузка переписки...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-8">
                      Сообщений пока нет.
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${
                          m.sender === "client" ? "justify-start" : "justify-end"
                        }`}
                      >
                        <div
                          className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm whitespace-pre-line ${
                            m.sender === "client"
                              ? "bg-white border border-slate-200 text-neutral-900 rounded-bl-sm"
                              : "bg-neutral-950 text-white rounded-br-sm"
                          }`}
                        >
                          <div className="text-[10px] opacity-60 mb-1">
                            {m.sender === "client"
                              ? "Клиент"
                              : m.sender === "ai"
                              ? "TIYIN AI"
                              : "Менеджер"}{" "}
                            • {formatDate(m.created_at)}
                          </div>
                          {m.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Bot className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">Выберите диалог слева, чтобы посмотреть переписку</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: DAILY NOTES & TELEGRAM NOTIFICATIONS */}
      {subTab === "settings" && (
        <form onSubmit={handleSaveSettings} className="space-y-5 max-w-2xl">
          {/* Status Card (read-only prompt notice) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-neutral-950">
                    Статус сценария TIYIN AI
                  </div>
                  <div className="text-xs text-slate-500">{statusLabel}</div>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  aiEnabled
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {aiEnabled ? "Активен" : "На паузе"}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
              <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Базовую логику продаж настраивает команда TIYIN Space. Ниже вы можете
                задавать быстрые обновления на сегодня и подключить мгновенные заказы в
                Telegram.
              </span>
            </div>
          </div>

          {/* Daily Notes */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
            <label className="block font-semibold text-sm text-neutral-950">
              Быстрые указания для ИИ на сегодня
            </label>
            <p className="text-xs text-slate-500">
              Агент сразу учтет эту информацию в ответах клиентам (не ломая основной
              сценарий).
            </p>
            <textarea
              rows={3}
              value={dailyNotes}
              onChange={(e) => setDailyNotes(e.target.value)}
              placeholder="Например: Сегодня скидка 10% на самовывоз. Белые розы закончились, предлагайте тюльпаны. Доставка по Алматы 1 500 ₸."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          {/* Telegram Instant Notifications */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-600" />
              <label className="font-semibold text-sm text-neutral-950">
                Мгновенные заказы в ваш Telegram
              </label>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Каждый новый заказ с витрины и из всех соцсетей будет мгновенно приходить
              вам в Telegram. Чтобы узнать свой <strong>Chat ID</strong>, напишите боту{" "}
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 font-semibold underline"
              >
                @userinfobot
              </a>{" "}
              и вставьте полученное число ниже (и не забудьте нажать /start в боте
              уведомлений TIYIN Space).
            </p>
            <input
              type="text"
              value={channels.owner_telegram_chat_id || ""}
              onChange={(e) =>
                setChannels({ ...channels, owner_telegram_chat_id: e.target.value })
              }
              placeholder="Например: 512345678"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-sm font-semibold transition"
          >
            <Save className="w-4 h-4" />
            {savingSettings ? "Сохраняем..." : "Сохранить настройки TIYIN AI"}
          </button>
        </form>
      )}

      {/* SUBTAB 3: MODULAR SUBSCRIPTION CONSTRUCTOR */}
      {subTab === "subscription" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-neutral-950">
                Конструктор подписки TIYIN AI
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Кабинет и витрина TIYIN Space всегда бесплатны. Выберите только те каналы,
                где нужен ИИ-автопилот — мы настроим и подключим их под ключ. При выборе
                всех каналов действует скидка {ALL_IN_DISCOUNT_PERCENT}%.
              </p>
            </div>

            {/* Module Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUBSCRIPTION_MODULES.map((mod) => {
                const checked = selectedModules.includes(mod.id);
                const alreadyActive =
                  (mod.id === "web" && channels.web_enabled) ||
                  (mod.id === "whatsapp" && channels.whatsapp_enabled) ||
                  (mod.id === "instagram" && channels.instagram_enabled) ||
                  (mod.id === "telegram" && channels.telegram_enabled);

                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className={`text-left p-4 rounded-2xl border-2 transition ${
                      checked
                        ? "border-neutral-950 bg-neutral-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-neutral-950">
                          {mod.title}
                        </div>
                        {alreadyActive && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                            Уже активен
                          </span>
                        )}
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                          checked
                            ? "bg-neutral-950 border-neutral-950 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      {mod.description}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-950">
                        {formatKZT(mod.priceMonthly)} / мес
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3" />
                        Запуск: {mod.setupDays} дн.
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Summary & Request Form */}
            <form
              onSubmit={handleSubmitSubscription}
              className="bg-neutral-950 text-white rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-neutral-400">
                    Выбрано модулей: {calc.modules.length} • Срок поэтапного запуска: до{" "}
                    {calc.estimatedDays}{" "}
                    {calc.estimatedDays === 1 ? "дня" : "дней"}
                  </div>
                  <div className="flex items-baseline gap-2.5 mt-1">
                    <span className="text-2xl font-bold">
                      {formatKZT(calc.finalPrice)} / мес
                    </span>
                    {calc.hasAllDiscount && (
                      <span className="text-xs text-emerald-400 font-semibold">
                        Скидка −{ALL_IN_DISCOUNT_PERCENT}% (−{formatKZT(calc.discount)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="tel"
                  value={subContactPhone}
                  onChange={(e) => setSubContactPhone(e.target.value)}
                  placeholder="Ваш WhatsApp / телефон для связи"
                  className="px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white"
                  required
                />
                <input
                  type="text"
                  value={subComment}
                  onChange={(e) => setSubComment(e.target.value)}
                  placeholder="Комментарий (необязательно)"
                  className="px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white"
                />
              </div>

              <button
                type="submit"
                disabled={sendingReq || selectedModules.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-50 text-neutral-950 font-semibold text-sm transition"
              >
                <Send className="w-4 h-4" />
                {sendingReq ? "Отправляем..." : "Отправить заявку на подключение"}
              </button>
            </form>
          </div>

          {/* Request History */}
          {subscriptionRequests.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h3 className="font-bold text-sm text-neutral-950">Ваши заявки на TIYIN AI</h3>
              <div className="divide-y divide-slate-100">
                {subscriptionRequests.map((req) => {
                  const st = REQ_STATUS_LABEL[req.status] || REQ_STATUS_LABEL.new;
                  return (
                    <div
                      key={req.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                    >
                      <div>
                        <div className="font-medium text-neutral-900">
                          Каналы:{" "}
                          {Array.isArray(req.selected_channels)
                            ? req.selected_channels.join(", ")
                            : ""}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {formatDate(req.created_at)} • Запуск до {req.estimated_days} дн.
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-neutral-950">
                          {formatKZT(req.monthly_price)}/мес
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.className}`}
                        >
                          {st.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
