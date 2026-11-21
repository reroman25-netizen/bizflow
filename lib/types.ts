export type UserRole = "client" | "business" | "admin";

export type ChannelType = "web" | "whatsapp" | "instagram" | "telegram";

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
  city: string;
  category?: string;
  tagline: string;
  services_description: string;
  address: string;
  working_hours: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  kaspi_pay_link?: string;
  halyk_enabled?: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface BusinessAiConfig {
  business_id: string;
  ai_enabled: boolean;
  status_label: string;
  system_prompt: string;
  daily_notes?: string;
}

export interface BusinessChannelsPublic {
  business_id: string;
  web_enabled: boolean;
  whatsapp_enabled: boolean;
  instagram_enabled: boolean;
  telegram_enabled: boolean;
  owner_telegram_chat_id: string;
}

export interface BusinessChannelsAdmin extends BusinessChannelsPublic {
  whatsapp_instance_id: string;
  whatsapp_api_token: string;
  telegram_bot_token: string;
  instagram_page_id: string;
  instagram_access_token: string;
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
  delivery_method?: string;
  source?: ChannelType | string;
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

export type ConversationTag = "consultation" | "hot" | "needs_human" | "ordered";

export interface Conversation {
  id: string;
  business_id: string;
  channel: ChannelType;
  external_user_id: string;
  client_name: string;
  client_phone: string;
  summary: string;
  tag: ConversationTag;
  ai_paused: boolean;
  last_message_at: string;
  created_at: string;
}

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  business_id: string;
  sender: "client" | "ai" | "owner";
  content: string;
  created_at: string;
}

export interface SubscriptionRequest {
  id: string;
  business_id: string;
  selected_channels: string[];
  monthly_price: number;
  estimated_days: number;
  contact_phone: string;
  comment: string;
  status: "new" | "in_progress" | "active" | "rejected";
  created_at: string;
}
