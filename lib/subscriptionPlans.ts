export type SubscriptionChannelId = "web" | "whatsapp" | "instagram" | "telegram";

export interface SubscriptionTier {
  id: "start" | "autopilot";
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
    id: "start",
    title: "TIYIN AI Старт",
    badge: "Витрина + Telegram",
    subtitle: "ИИ-продавец на вашей витрине и в Telegram-боте",
    priceMonthly: 5000,
    setupDays: 1,
    channels: ["web", "telegram"],
    features: [
      "ИИ-консультант 24/7 прямо на вашей витрине TIYIN",
      "Собственный Telegram-бот компании с каталогом",
      "Автоматический прием заказов и отправка в ваш Telegram",
      "Единая база клиентов и быстрые заметки для ИИ",
    ],
  },
  {
    id: "autopilot",
    title: "TIYIN AI Автопилот",
    badge: "Всё включено",
    subtitle: "Полная автоматизация соцсетей и мессенджеров",
    priceMonthly: 20000,
    setupDays: 3,
    channels: ["web", "telegram", "whatsapp", "instagram"],
    features: [
      "Всё из тарифа «Старт» (Витрина + Telegram)",
      "ИИ-агент в WhatsApp (текст, голосовые RU/KZ и фото)",
      "ИИ-агент в Instagram Direct + ответы на комментарии",
      "Все заказы и чаты со всех площадок в одном окне",
      "Перехват диалога менеджером в 1 клик (Пауза ИИ)",
    ],
  },
];

// Совместимость с API /api/subscription-request
export function calculateSubscription(selectedIds: SubscriptionChannelId[]) {
  const unique = Array.from(new Set(selectedIds));
  const needsSocials = unique.includes("whatsapp") || unique.includes("instagram");
  const tier = needsSocials ? SUBSCRIPTION_TIERS[1] : SUBSCRIPTION_TIERS[0];

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
