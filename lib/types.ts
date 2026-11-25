export type UserRole = "client" | "business" | "admin";

export type ChannelType = "web" | "whatsapp" | "instagram" | "telegram";

export type ProductItemType = "product" | "service";

export type StorefrontTemplate = "shop" | "services";

export type ProductBadge = "hit" | "new" | "in_stock" | "discount";

export type DeliveryPricingMode = "fixed" | "included";

export type DeliveryStatus =
  | "queued"
  | "estimating"
  | "request_sent"
  | "ready_for_approval"
  | "searching_courier"
  | "courier_found"
  | "picked_up"
  | "delivered"
  | "cancelled"
  | "failed"
  | "needs_attention";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  telegram_id?: string | null;
  telegram_username?: string;
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
  instagram?: string;
  cover_url?: string;
  logo_url?: string;
  pwa_short_name?: string;
  pwa_enabled?: boolean;
  storefront_template?: StorefrontTemplate;
  brand_color?: string;
  plan_tier?: "base" | "pro" | "ai_autopilot";
  pro_trial_used?: boolean;
  pro_trial_ends_at?: string | null;
  trial_ends_at?: string | null;
  paid_until?: string | null;
  billing_note?: string;
  kaspi_pay_link?: string;
  halyk_enabled?: boolean;
  halyk_api_enabled?: boolean;
  freedom_api_enabled?: boolean;
  delivery_enabled?: boolean;
  delivery_api_enabled?: boolean;
  delivery_pricing_mode?: DeliveryPricingMode;
  delivery_fixed_price?: number;
  delivery_free_from?: number | null;
  delivery_min_order?: number | null;
  delivery_show_included_badge?: boolean;
  delivery_pickup_address?: string;
  delivery_pickup_lat?: number | null;
  delivery_pickup_lng?: number | null;
  delivery_pickup_entrance?: string;
  delivery_pickup_phone?: string;
  delivery_pickup_comment?: string;
  legal_name?: string;
  bin_iin?: string;
  offer_accepted_at?: string | null;
  offer_version?: string;
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
  telegram_order_recipients?: TelegramOrderRecipient[];
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
  image_url?: string;
  gallery_urls?: string[];
  item_type?: ProductItemType;
  duration_label?: string;
  old_price?: number | null;
  cashback_percent?: number;
  badges?: ProductBadge[] | string[];
  is_available: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export type OrderStatus = "new" | "in_progress" | "done" | "cancelled";

export type PaymentStatus = "unpaid" | "pending_review" | "paid" | "failed";

export interface TelegramOrderRecipient {
  id: string;
  name: string;
  chat_id: string;
}

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
  payment_status?: PaymentStatus;
  payment_provider?: string;
  receipt_url?: string;
  receipt_uploaded_at?: string | null;
  delivery_method?: string;
  delivery_fee?: number;
  delivery_address?: string;
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

export interface BillingPayment {
  id: string;
  business_id: string;
  amount: number;
  months: number;
  plan_tier: "base" | "ai_autopilot" | string;
  paid_at: string;
  comment: string;
  created_at: string;
}

export interface PaymentSettingsPublic {
  kaspi_pay_link: string;
  halyk_enabled: boolean;
  halyk_api_enabled: boolean;
  halyk_client_id: string;
  halyk_terminal_id: string;
  halyk_has_secret: boolean;
  halyk_test_mode: boolean;
  freedom_api_enabled: boolean;
  freedom_merchant_id: string;
  freedom_has_secret: boolean;
  freedom_test_mode: boolean;
}

export interface BusinessSlide {
  id: string;
  business_id: string;
  media_url: string;
  media_type: "image" | "video";
  title: string;
  subtitle: string;
  badge_text: string;
  link_category: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface BusinessCategory {
  id: string;
  business_id: string;
  name: string;
  image_url: string;
  icon_key: string;
  sort_order: number;
  created_at?: string;
}

export interface DeliveryWallet {
  business_id: string;
  balance: number;
  held_balance: number;
  updated_at?: string;
}

export interface DeliveryWalletTransaction {
  id: string;
  business_id: string;
  order_id?: string | null;
  order_code: string;
  delivery_id?: string | null;
  type: "topup" | "hold" | "charge" | "refund" | "adjustment" | string;
  amount: number;
  balance_after: number;
  description: string;
  client_fee_note: string;
  status: "pending" | "completed" | "cancelled" | string;
  created_at: string;
}

export interface DeliveryRecord {
  id: string;
  order_id: string;
  business_id: string;
  provider: string;
  idempotency_key: string;
  external_claim_id: string;
  status: DeliveryStatus;
  provider_price: number;
  platform_markup: number;
  final_price: number;
  held_amount?: number;
  yandex_version?: number;
  wallet_settled?: boolean;
  pickup_address: string;
  dropoff_address: string;
  courier_name: string;
  courier_phone: string;
  tracking_url: string;
  last_error: string;
  created_at: string;
  updated_at: string;
}

export interface ClientDeliverySummary {
  id: string;
  status: DeliveryStatus;
  courier_name: string;
  courier_phone: string;
  tracking_url: string;
}
