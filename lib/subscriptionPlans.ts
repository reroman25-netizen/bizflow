export type SubscriptionChannelId = "web" | "whatsapp" | "instagram" | "telegram";

export const BASE_PLAN_TRIAL_MONTHS = 6;
export const BASE_PLAN_MONTHLY_PRICE = 990;
export const AI_AUTOPILOT_MONTHLY_PRICE = 25000;

export interface SubscriptionTier {
  id: "autopilot";
  title: string;
  badge: string;
  subtitle: string;
  priceMonthly: number;
  setupDays: number;
  channels: SubscriptionChannelId[];
  features: string[];
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "autopilot",
    title: "TIYIN AI Автопилот",
    badge: "Все площадки • 24/7",
    subtitle: "ИИ-агенты общаются с клиентами и принимают заявки во всех соцсетях и на витрине",
    priceMonthly: AI_AUTOPILOT_MONTHLY_PRICE,
    setupDays: 3,
    channels: ["web", "telegram", "whatsapp", "instagram"],
    features: [
      "ИИ-агенты 24/7 в WhatsApp, Instagram, Telegram и на вашей витрине",
      "Прием заявок и мгновенная отправка готовых заказов напрямую в ваш Telegram",
      "Единый кабинет: продажи, оборот и прямой чат со всех площадок в одном окне",
      "Автоматический сбор общей базы клиентов со всех соцсетей и витрины",
      "Перехват любого диалога менеджером в 1 клик (Пауза ИИ)",
    ],
  },
];

// Совместимость с API /api/subscription-request
export function calculateSubscription(_selectedIds?: SubscriptionChannelId[]) {
  const tier = SUBSCRIPTION_TIERS[0];

  return {
    tier,
    modules: tier.channels.map((id) => ({
      id,
      title:
        id === "web"
          ? "Витрина TIYIN"
          : id === "telegram"
          ? "Telegram"
          : id === "whatsapp"
          ? "WhatsApp"
          : "Instagram",
    })),
    rawPrice: tier.priceMonthly,
    discount: 0,
    finalPrice: tier.priceMonthly,
    estimatedDays: tier.setupDays,
    hasAllDiscount: false,
  };
}

export type BillingStateKind = "trial" | "paid" | "expiring_soon" | "grace" | "overdue";

export interface BillingStatusInfo {
  status: BillingStateKind;
  label: string;
  registeredAt: Date;
  activeUntil: Date;
  daysUsed: number;
  daysLeft: number;
  isPaid: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getBillingStatus(biz: {
  created_at?: string;
  trial_ends_at?: string | null;
  paid_until?: string | null;
}): BillingStatusInfo {
  const now = new Date();
  const registeredAt = biz.created_at ? new Date(biz.created_at) : now;

  const defaultTrialEnd = new Date(registeredAt);
  defaultTrialEnd.setMonth(defaultTrialEnd.getMonth() + BASE_PLAN_TRIAL_MONTHS);

  const trialEnd = biz.trial_ends_at ? new Date(biz.trial_ends_at) : defaultTrialEnd;
  const paidEnd = biz.paid_until ? new Date(biz.paid_until) : null;

  const isPaid = Boolean(paidEnd && paidEnd.getTime() > trialEnd.getTime());
  const activeUntil = isPaid && paidEnd ? paidEnd : trialEnd;

  const daysUsed = Math.max(1, Math.floor((now.getTime() - registeredAt.getTime()) / DAY_MS) + 1);
  const daysLeft = Math.ceil((activeUntil.getTime() - now.getTime()) / DAY_MS);

  let status: BillingStateKind = isPaid ? "paid" : "trial";
  let label = isPaid ? "Подписка активна" : "Бесплатный период (6 мес.)";

  if (daysLeft < -7) {
    status = "overdue";
    label = "Требуется оплата";
  } else if (daysLeft < 0) {
    status = "grace";
    label = "Льготный период";
  } else if (daysLeft <= 14) {
    status = "expiring_soon";
    label = isPaid ? "Скоро продление" : "Бесплатный период заканчивается";
  }

  return {
    status,
    label,
    registeredAt,
    activeUntil,
    daysUsed,
    daysLeft,
    isPaid,
  };
}
