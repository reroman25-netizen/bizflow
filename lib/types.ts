export type UserRole = "client" | "business" | "admin";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
}

export interface Business {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  tagline: string;
  services_description: string;
  address: string;
  working_hours: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  is_active: boolean;
  created_at?: string;
}

export interface BusinessAiConfig {
  business_id: string;
  ai_enabled: boolean;
  status_label: string;
  system_prompt: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  is_available: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export type OrderStatus = "new" | "in_progress" | "done" | "cancelled";

export interface Order {
  id: string;
  order_code: string;
  business_id: string;
  client_name: string;
  client_phone: string;
  comment: string;
  items: OrderItem[];
  total_price: number;
  status: OrderStatus;
  payment_method: string;
  created_at: string;
}

export interface ClientRecord {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  orders_count: number;
  total_spent: number;
  last_order_at: string;
}
