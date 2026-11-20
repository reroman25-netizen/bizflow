import { PlatformData } from "./types";

const STORAGE_KEY = "bizflow_kz_data_v1";

export const DEFAULT_DATA: PlatformData = {
  business: {
    slug: "aigerim",
    name: "Чебуречная у Айгерим",
    tagline: "Горячие чебуреки, самса и домашние напитки в Алматы",
    address: "г. Алматы, ул. Достык, 40",
    workingHours: "Ежедневно 09:00 – 22:00",
    whatsappPhone: "+77071234567",
    kaspiPhone: "+7 707 123 45 67",
    aiEnabled: true,
    aiPrompt:
      "Ты вежливый администратор кафе «Чебуречная у Айгерим». Отвечай кратко, по делу, помогай выбрать блюда из актуального меню и предлагай оформить заказ прямо на витрине.",
  },
  products: [
    {
      id: "p1",
      name: "Чебурек с говядиной",
      description: "Сочная рубленная говядина, лук, хрустящее тесто",
      price: 750,
      category: "Выпечка",
      isAvailable: true,
    },
    {
      id: "p2",
      name: "Чебурек с сыром и зеленью",
      description: "Тянущийся сулугуни со свежей зеленью",
      price: 650,
      category: "Выпечка",
      isAvailable: true,
    },
    {
      id: "p3",
      name: "Самса тандырная с говядиной",
      description: "Слоеное тесто, запечена в тандыре",
      price: 600,
      category: "Выпечка",
      isAvailable: true,
    },
    {
      id: "p4",
      name: "Комбо «Сытный обед»",
      description: "2 чебурека с говядиной + домашний морс 0.5 л",
      price: 1850,
      category: "Комбо",
      isAvailable: true,
    },
    {
      id: "p5",
      name: "Домашний ягодный морс 0.5л",
      description: "Охлажденный морс из смородины и клюквы",
      price: 500,
      category: "Напитки",
      isAvailable: true,
    },
  ],
  orders: [
    {
      id: "ORD-1042",
      clientName: "Арман Сериков",
      clientPhone: "+7 701 555 12 34",
      address: "пр. Абая 52, кв 14",
      items: [
        { productId: "p4", name: "Комбо «Сытный обед»", price: 1850, quantity: 1 },
        { productId: "p3", name: "Самса тандырная с говядиной", price: 600, quantity: 2 },
      ],
      totalPrice: 3050,
      status: "in_progress",
      paymentMethod: "Kaspi Pay",
      createdAt: "Сегодня, 11:20",
    },
    {
      id: "ORD-1041",
      clientName: "Динара К.",
      clientPhone: "+7 777 234 90 11",
      address: "Самовывоз",
      items: [
        { productId: "p1", name: "Чебурек с говядиной", price: 750, quantity: 3 },
      ],
      totalPrice: 2250,
      status: "done",
      paymentMethod: "Kaspi Pay",
      createdAt: "Сегодня, 10:05",
    },
  ],
  clients: [
    {
      id: "c1",
      name: "Арман Сериков",
      phone: "+7 701 555 12 34",
      ordersCount: 4,
      totalSpent: 12400,
      lastOrderAt: "Сегодня, 11:20",
    },
    {
      id: "c2",
      name: "Динара К.",
      phone: "+7 777 234 90 11",
      ordersCount: 2,
      totalSpent: 4800,
      lastOrderAt: "Сегодня, 10:05",
    },
  ],
};

export function loadPlatformData(): PlatformData {
  if (typeof window === "undefined") return DEFAULT_DATA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as PlatformData;
    if (!parsed || !parsed.business || !Array.isArray(parsed.products)) {
      return DEFAULT_DATA;
    }
    return parsed;
  } catch {
    return DEFAULT_DATA;
  }
}

export function savePlatformData(data: PlatformData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export function formatKZT(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸";
}
