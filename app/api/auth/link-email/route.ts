import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Не настроены ключи Supabase на сервере." },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes, error: userErr } = await admin.auth.getUser(accessToken);
    if (userErr || !userRes.user) {
      return NextResponse.json({ error: "Сессия недействительна." }, { status: 401 });
    }

    const currentUser = userRes.user;
    const body = await req.json();
    const cleanEmail = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail) || cleanEmail.endsWith("@telegram.tiyin.kz")) {
      return NextResponse.json(
        { error: "Укажите корректную электронную почту." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль должен содержать минимум 6 символов." },
        { status: 400 }
      );
    }

    const { data: existingEmailProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", cleanEmail)
      .neq("id", currentUser.id)
      .maybeSingle();

    if (existingEmailProfile) {
      return NextResponse.json(
        { error: "Эта почта уже привязана к другому аккаунту TIYIN Space." },
        { status: 409 }
      );
    }

    const { error: updateErr } = await admin.auth.admin.updateUserById(currentUser.id, {
      email: cleanEmail,
      password,
      email_confirm: true,
    });

    if (updateErr) {
      const msg = updateErr.message || "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
        return NextResponse.json(
          { error: "Эта почта уже используется в другом аккаунте." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: msg || "Не удалось обновить почту и пароль." },
        { status: 400 }
      );
    }

    await admin
      .from("profiles")
      .update({ email: cleanEmail })
      .eq("id", currentUser.id);

    return NextResponse.json({
      ok: true,
      email: cleanEmail,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка привязки почты." },
      { status: 500 }
    );
  }
}
