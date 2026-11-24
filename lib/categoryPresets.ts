export interface CategoryPreset {
  key: string;
  name: string;
  emoji: string;
  bg: string;
  group: string;
}

export const CATEGORY_PRESETS: CategoryPreset[] = [
  // Авто и СТО
  { key: "oils", name: "Масла и жидкости", emoji: "🛢️", bg: "#FEF3C7", group: "Авто" },
  { key: "tires", name: "Шины и диски", emoji: "🛞", bg: "#E2E8F0", group: "Авто" },
  { key: "autoparts", name: "Автозапчасти", emoji: "⚙️", bg: "#DBEAFE", group: "Авто" },
  { key: "auto_acc", name: "Автоаксессуары", emoji: "🚗", bg: "#FEE2E2", group: "Авто" },
  { key: "batteries", name: "Аккумуляторы", emoji: "🔋", bg: "#DCFCE7", group: "Авто" },
  { key: "car_service", name: "Замена масла и ТО", emoji: "🔧", bg: "#F3E8FF", group: "Авто" },

  // Еда и кафе
  { key: "pizza", name: "Пицца", emoji: "🍕", bg: "#FFEDD5", group: "Еда" },
  { key: "burgers", name: "Бургеры и фастфуд", emoji: "🍔", bg: "#FEF3C7", group: "Еда" },
  { key: "sushi", name: "Суши и роллы", emoji: "🍣", bg: "#FFE4E6", group: "Еда" },
  { key: "hot_food", name: "Горячие блюда", emoji: "🍲", bg: "#FEE2E2", group: "Еда" },
  { key: "drinks", name: "Напитки и кофе", emoji: "☕", bg: "#E0E7FF", group: "Еда" },
  { key: "desserts", name: "Десерты и выпечка", emoji: "🧁", bg: "#FCE7F3", group: "Еда" },

  // Одежда, обувь, аксессуары
  { key: "clothes", name: "Одежда", emoji: "👕", bg: "#DBEAFE", group: "Магазин" },
  { key: "shoes", name: "Обувь", emoji: "👟", bg: "#E0F2FE", group: "Магазин" },
  { key: "bags", name: "Сумки и аксессуары", emoji: "👜", bg: "#FCE7F3", group: "Магазин" },
  { key: "flowers", name: "Цветы и подарки", emoji: "💐", bg: "#FFE4E6", group: "Магазин" },

  // Техника и дом
  { key: "electronics", name: "Электроника", emoji: "📱", bg: "#E0E7FF", group: "Дом и техника" },
  { key: "appliances", name: "Бытовая техника", emoji: "🧺", bg: "#E2E8F0", group: "Дом и техника" },
  { key: "furniture", name: "Мебель", emoji: "🛋️", bg: "#FEF3C7", group: "Дом и техника" },
  { key: "home_goods", name: "Посуда и дом", emoji: "🏠", bg: "#DCFCE7", group: "Дом и техника" },

  // Красота, здоровье и услуги
  { key: "beauty", name: "Косметика и уход", emoji: "💄", bg: "#FCE7F3", group: "Услуги" },
  { key: "barber", name: "Стрижки и барбер", emoji: "✂️", bg: "#F1F5F9", group: "Услуги" },
  { key: "health", name: "Витамины и здоровье", emoji: "💊", bg: "#DCFCE7", group: "Услуги" },
  { key: "promo", name: "Акции и наборы", emoji: "🔥", bg: "#FEE2E2", group: "Услуги" },
];
