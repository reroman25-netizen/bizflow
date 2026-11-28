import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createSignedStartParam,
  createSixDigitLinkCode,
} from "@/lib/telegramLinkStore";

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

    const userId = userRes.user.id;
    const code = createSixDigitLinkCode(userId, 15);
    const startParam = createSignedStartParam(userId, 30);

    const botUsername = (
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "tiyinapp_bot"
    )
      .replace(/^@/, "")
      .trim();

    const deepLink = `https://t.me/${botUsername}?startapp=${startParam}`;

    return NextResponse.json({
      ok: true,
      code,
      deepLink,
      expiresInMinutes: 15,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось создать код привязки." },
      { status: 500 }
    );
  }
}
