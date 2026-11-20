-- Выполните этот скрипт в Supabase -> SQL Editor, когда будете готовы подключить постоянную БД

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id),
  name text not null,
  slug text unique not null,
  category text default 'Услуги',
  whatsapp_phone text,
  kaspi_phone text,
  ai_prompt text,
  ai_enabled boolean default true,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  description text,
  price integer not null,
  category text default 'Основное',
  is_available boolean default true,
  created_at timestamptz default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  phone text not null,
  name text not null,
  orders_count integer default 0,
  total_spent integer default 0,
  created_at timestamptz default now(),
  unique (business_id, phone)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  client_id uuid references clients(id) on delete set null,
  client_name text not null,
  client_phone text not null,
  address text,
  items jsonb not null,
  total_price integer not null,
  status text default 'new', -- new | in_progress | done | cancelled
  payment_status text default 'paid_kaspi',
  created_at timestamptz default now()
);

-- Включаем Row Level Security (RLS)
alter table businesses enable row level security;
alter table products enable row level security;
alter table clients enable row level security;
alter table orders enable row level security;

-- Публичное чтение бизнеса и его активных товаров для витрины /[slug]
create policy "Public read businesses" on businesses for select using (true);
create policy "Public read products" on products for select using (is_available = true);
create policy "Public create orders" on orders for insert with check (true);
