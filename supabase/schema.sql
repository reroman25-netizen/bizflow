-- Полная схема TIYIN Space (для нового проекта Supabase)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text default '',
  role text not null default 'client' check (role in ('client', 'business', 'admin')),
  created_at timestamptz default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null unique,
  slug text unique not null,
  name text not null,
  city text default 'Алматы',
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

create table if not exists public.business_ai_configs (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  ai_enabled boolean default true,
  status_label text default 'Подключен (настраивается администратором)',
  system_prompt text default '',
  updated_at timestamptz default now()
);

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

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_ai_configs enable row level security;
alter table public.products enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.profiles to authenticated;
grant select on public.businesses to anon;
grant select, insert, update on public.businesses to authenticated;
grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;
grant select on public.clients to authenticated;
grant select, update on public.orders to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
