# BizFlow KZ (v2 — Supabase Auth + Кабинет бизнеса + Витрины + Админка)

## Настройка перед запуском
1. Выполните `supabase/schema.sql` в Supabase → **SQL Editor**.
2. В Supabase → **Authentication → Providers → Email** отключите **Confirm email** (чтобы бизнесы сразу попадали в кабинет после регистрации без настройки почтового сервера).
3. В Vercel → **Settings → Environment Variables** добавьте:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_EMAIL` (ваша почта для входа в `/admin`)
   - `GEMINI_API_KEY` (опционально, для живого ИИ-агента)
