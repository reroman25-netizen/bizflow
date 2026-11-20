export interface BusinessProfile {
  slug: string;
  name: string;
  tagline: string;
  address: string;
  workingHours: string;
  whatsappPhone: string;
  kaspiPhone: string;
  aiEnabled: boolean;
  aiPrompt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export type OrderStatus = "new" | "in_progress" | "done";

export interface Order {
  id: string;
  clientName: string;
  clientPhone: string;
  address: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  paymentMethod: "Kaspi Pay" | "Наличные";
  createdAt: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  phone: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string;
}

export interface PlatformData {
  business: BusinessProfile;
  products: Product[];
  orders: Order[];
  clients: ClientRecord[];
}
