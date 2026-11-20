import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Не заданы переменные NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function verifyAdminRequest(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false as const, error: "Требуется авторизация" };
  }
  const token = authHeader.slice(7).trim();
  const admin = getSupabaseAdmin();
  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData?.user) {
    return { ok: false as const, error: "Недействительная сессия" };
  }

  const user = userData.user;
  const envAdminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const userEmail = (user.email || "").trim().toLowerCase();

  let isAdmin = Boolean(envAdminEmail && userEmail && userEmail === envAdminEmail);

  if (!isAdmin) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "admin") {
      isAdmin = true;
    }
  }

  if (!isAdmin) {
    return { ok: false as const, error: "Доступ разрешен только супер-администратору" };
  }

  return { ok: true as const, user, admin };
}
