-- =====================================================================
-- TIYIN Space — Единая миграция базы данных (Этапы 1–3)
-- Выполните один раз в Supabase -> SQL Editor -> New query -> Run.
-- Существующие данные и таблицы НЕ удаляются.
-- =====================================================================

-- 1. Категория деятельности и настройки оплаты для бизнесов
alter table public.businesses add column if not exists category text default 'Магазин';
alter table public.businesses add column if not exists kaspi_pay_link text default '';
alter table public.businesses add column if not exists halyk_enabled boolean default false;

update public.businesses set category = 'Магазин' where category is null or category = '';

-- 2. Источник заказа и способ доставки в orders
alter table public.orders add column if not exists source text default 'web';
alter table public.orders add column if not exists delivery_method text default 'Самовывоз / Уточнить';

-- 3. Ежедневные заметки владельца для ИИ (не затрагивают скрытый системный промпт)
alter table public.business_ai_configs add column if not exists daily_notes text default '';

-- 4. Каналы и ключи интеграций (закрытая таблица — только сервер и /admin)
create table if not exists public.business_channels (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  web_enabled boolean default true,
  whatsapp_enabled boolean default false,
  instagram_enabled boolean default false,
  telegram_enabled boolean default false,
  owner_telegram_chat_id text default '',
  whatsapp_instance_id text default '',
  whatsapp_api_token text default '',
  telegram_bot_token text default '',
  instagram_page_id text default '',
  instagram_access_token text default '',
  updated_at timestamptz default now()
);

-- 5. Единый реестр диалогов со всех площадок
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  channel text not null default 'web' check (channel in ('web', 'whatsapp', 'instagram', 'telegram')),
  external_user_id text not null,
  client_name text default 'Гость',
  client_phone text default '',
  summary text default '',
  tag text default 'consultation' check (tag in ('consultation', 'hot', 'needs_human', 'ordered')),
  ai_paused boolean default false,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (business_id, channel, external_user_id)
);

-- 6. История сообщений (память ИИ + просмотр в кабинете TIYIN AI)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  business_id uuid references public.businesses(id) on delete cascade not null,
  sender text not null check (sender in ('client', 'ai', 'owner')),
  content text not null,
  created_at timestamptz default now()
);

-- 7. Заявки из Конструктора подписки TIYIN AI
create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  selected_channels jsonb not null default '[]'::jsonb,
  monthly_price integer not null default 0,
  estimated_days integer not null default 1,
  contact_phone text default '',
  comment text default '',
  status text default 'new' check (status in ('new', 'in_progress', 'active', 'rejected')),
  created_at timestamptz default now()
);

-- Включаем RLS
alter table public.business_channels enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.subscription_requests enable row level security;

-- Политики доступа для владельцев бизнеса (business_channels остается полностью закрытой!)
drop policy if exists "Owner manage own conversations" on public.conversations;
create policy "Owner manage own conversations"
  on public.conversations for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = conversations.business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = conversations.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner read own messages" on public.messages;
create policy "Owner read own messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = messages.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner manage own subscription_requests" on public.subscription_requests;
create policy "Owner manage own subscription_requests"
  on public.subscription_requests for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = subscription_requests.business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = subscription_requests.business_id and b.owner_id = auth.uid()
    )
  );

-- Права ролей PostgreSQL
grant select, update on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant select, insert on public.subscription_requests to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
