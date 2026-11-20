-- Выполните этот короткий скрипт в Supabase -> SQL Editor, чтобы добавить поддержку городов
alter table public.businesses add column if not exists city text default 'Алматы';
update public.businesses set city = 'Алматы' where city is null or city = '';
