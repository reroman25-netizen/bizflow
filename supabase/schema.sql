-- =========================================================
-- BizFlow KZ — Схема базы данных и прав доступа (RLS)
-- Вставьте целиком в Supabase -> SQL Editor и нажмите Run
-- =========================================================

-- 1. Профили пользователей (роли: client, business, admin)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text default '',
  role text not null default 'client' check (role in ('client', 'business', 'admin')),
  created_at timestamptz default now()
);

-- 2. Бизнесы (один владелец -> одна платформа бизнеса)
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null unique,
  slug text unique not null,
  name text not null,
  tagline text default '',
  services_description text default '',
  address text default '',
  working_hours text default 'Ежедневно 09:00 – 21:00',
  phone text default '',
  whatsapp text default '',
  telegram text default '',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3. Скрытые настройки ИИ-агента (доступны ТОЛЬКО супер-админу и серверу)
create table if not exists public.business_ai_configs (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  ai_enabled boolean default true,
  status_label text default 'Подключен (настраивается администратором)',
  system_prompt text default '',
  updated_at timestamptz default now()
);

-- Автоматически создавать запись ИИ-конфига при создании нового бизнеса
create or replace function public.handle_new_business_ai()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.business_ai_configs (business_id, ai_enabled, status_label, system_prompt)
  values (
    new.id,
    true,
    'Подключен (базовая настройка администратора)',
    'Ты вежливый ИИ-администратор компании «' || new.name || '». Отвечай кратко, по делу, консультируй по актуальному каталогу и помогай оформить заказ на витрине.'
  )
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_business_created_ai on public.businesses;
create trigger on_business_created_ai
  after insert on public.businesses
  for each row execute procedure public.handle_new_business_ai();

-- 4. Каталог товаров и услуг
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  name text not null,
  description text default '',
  price integer not null default 0,
  category text default 'Услуги',
  is_available boolean default true,
  created_at timestamptz default now()
);

-- 5. База клиентов бизнеса
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text not null,
  orders_count integer default 1,
  total_spent integer default 0,
  last_order_at timestamptz default now(),
  unique (business_id, phone)
);

-- 6. Заказы и заявки
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null,
  business_id uuid references public.businesses(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  client_name text not null,
  client_phone text not null,
  comment text default '',
  items jsonb not null default '[]'::jsonb,
  total_price integer not null default 0,
  status text default 'new' check (status in ('new', 'in_progress', 'done', 'cancelled')),
  payment_method text default 'Согласуем с менеджером',
  created_at timestamptz default now()
);

-- =========================================================
-- Включаем Row Level Security (RLS)
-- =========================================================
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_ai_configs enable row level security;
alter table public.products enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;

-- PROFILES: пользователь видит и создает только свой профиль (роль admin через клиент запрещена)
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id and role in ('client', 'business'));

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role in ('client', 'business'));

-- BUSINESSES: активные витрины видны всем в поиске; менять может ТОЛЬКО владелец
drop policy if exists "Public read active businesses" on public.businesses;
create policy "Public read active businesses"
  on public.businesses for select
  using (is_active = true or auth.uid() = owner_id);

drop policy if exists "Owner insert business" on public.businesses;
create policy "Owner insert business"
  on public.businesses for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Owner update business" on public.businesses;
create policy "Owner update business"
  on public.businesses for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- BUSINESS_AI_CONFIGS: НЕТ политик для обычных пользователей и владельцев бизнеса!
-- Таблица полностью закрыта — доступ к ней имеет только сервер (service_role) и /admin.

-- PRODUCTS: публично видны доступные товары; управлять может только владелец бизнеса
drop policy if exists "Public read available products" on public.products;
create policy "Public read available products"
  on public.products for select
  using (
    is_available = true
    or exists (
      select 1 from public.businesses b
      where b.id = products.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner manage products" on public.products;
create policy "Owner manage products"
  on public.products for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = products.business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = products.business_id and b.owner_id = auth.uid()
    )
  );

-- CLIENTS: видит только владелец своего бизнеса (создание идет через сервер /api/orders)
drop policy if exists "Owner read clients" on public.clients;
create policy "Owner read clients"
  on public.clients for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = clients.business_id and b.owner_id = auth.uid()
    )
  );

-- ORDERS: владелец видит и обновляет статусы своих заказов; авторизованный клиент видит свои заказы
drop policy if exists "Owner read orders" on public.orders;
create policy "Owner read orders"
  on public.orders for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = orders.business_id and b.owner_id = auth.uid()
    )
    or auth.uid() = user_id
  );

drop policy if exists "Owner update order status" on public.orders;
create policy "Owner update order status"
  on public.orders for update
  using (
    exists (
      select 1 from public.businesses b
      where b.id = orders.business_id and b.owner_id = auth.uid()
    )
  );
