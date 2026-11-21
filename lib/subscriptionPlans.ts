export type SubscriptionChannelId = "web" | "whatsapp" | "instagram" | "telegram";

export interface SubscriptionModule {
  id: SubscriptionChannelId;
  title: string;
  description: string;
  priceMonthly: number;
  setupDays: number;
}

// Примерные цены — их можно в любой момент отредактировать здесь в одном файле
export const SUBSCRIPTION_MODULES: SubscriptionModule[] = [
  {
    id: "web",
    title: "ИИ на витрине TIYIN",
    description: "Консультации 24/7 на вашей витрине, автосбор заказов и уведомления в Telegram",
    priceMonthly: 8000,
    setupDays: 1,
  },
  {
    id: "whatsapp",
    title: "WhatsApp ИИ-агент",
    description: "Ответы клиентам в WhatsApp 24/7, голосовые RU/KZ, сбор заказов в единую ленту",
    priceMonthly: 18000,
    setupDays: 1,
  },
  {
    id: "instagram",
    title: "Instagram ИИ-агент",
    description: "Ответы в Direct и автоперехват комментариев («Цена?», «Қанша?»)",
    priceMonthly: 18000,
    setupDays: 2,
  },
  {
    id: "telegram",
    title: "Telegram-бот компании",
    description: "Отдельный брендированный ИИ-бот в Telegram с вашим каталогом",
    priceMonthly: 10000,
    setupDays: 1,
  },
];

export const ALL_IN_DISCOUNT_PERCENT = 15;

export function calculateSubscription(selectedIds: SubscriptionChannelId[]) {
  const unique = Array.from(new Set(selectedIds));
  const picked = SUBSCRIPTION_MODULES.filter((m) => unique.includes(m.id));
  const rawPrice = picked.reduce((sum, m) => sum + m.priceMonthly, 0);

  const hasAll = picked.length === SUBSCRIPTION_MODULES.length;
  const discount = hasAll ? Math.round((rawPrice * ALL_IN_DISCOUNT_PERCENT) / 100) : 0;
  const finalPrice = rawPrice - discount;

  // Срок запуска: 1 модуль = 1–2 дня, все модули поэтапно = 3 дня
  let estimatedDays = 1;
  if (picked.length >= 3) {
    estimatedDays = 3;
  } else if (picked.some((m) => m.id === "instagram") || picked.length === 2) {
    estimatedDays = 2;
  }

  return {
    modules: picked,
    rawPrice,
    discount,
    finalPrice,
    estimatedDays,
    hasAllDiscount: hasAll,
  };
}
