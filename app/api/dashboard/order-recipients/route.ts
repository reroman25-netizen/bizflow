import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegramNotify";

export const dynamic = "force-dynamic";

interface RecipientItem {
  id: string;
  name: string;
  chat_id: string;
}

async function getOwnedBusiness(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes.user) return null;

  const { data: biz } = await admin
    .from("businesses")
    .select("id, name")
    .eq("owner_id", userRes.user.id)
    .maybeSingle();

  if (!biz) return null;
  return { admin, business: biz };
}

export async function GET(req: NextRequest) {
  try {
    const owned = await getOwnedBusiness(req);
    if (!owned) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const { admin, business } = owned;
    const { data: chan } = await admin
      .from("business_channels")
      .select("owner_telegram_chat_id, telegram_order_recipients")
      .eq("business_id", business.id)
      .maybeSingle();

    const rawList = Array.isArray(chan?.telegram_order_recipients)
      ? (chan.telegram_order_recipients as RecipientItem[])
      : [];

    let recipients: RecipientItem[] = rawList
      .filter((r) => r && typeof r.chat_id === "string" && r.chat_id.trim())
      .map((r, idx) => ({
        id: String(r.id || `rec-${idx}`),
        name: String(r.name || "Менеджер").trim(),
        chat_id: String(r.chat_id).trim(),
      }));

    if (recipients.length === 0 && chan?.owner_telegram_chat_id?.trim()) {
      recipients = [
        {
          id: "owner-default",
          name: "Владелец",
          chat_id: chan.owner_telegram_chat_id.trim(),
        },
      ];
    }

    return NextResponse.json({ ok: true, recipients });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка загрузки" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const owned = await getOwnedBusiness(req);
    if (!owned) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const body = await req.json();
    const incoming = Array.isArray(body.recipients) ? body.recipients : [];

    const cleaned: RecipientItem[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < incoming.length; i++) {
      const item = incoming[i];
      const chatId = String(item?.chat_id || "").trim();
      const name = String(item?.name || "Менеджер").trim().slice(0, 40);
      if (!chatId || seen.has(chatId)) continue;
      seen.add(chatId);
      cleaned.push({
        id: String(item?.id || `rec-${Date.now()}-${i}`),
        name: name || "Менеджер",
        chat_id: chatId,
      });
    }

    const { admin, business } = owned;
    const primaryChatId = cleaned[0]?.chat_id || "";

    const { error } = await admin.from("business_channels").upsert(
      {
        business_id: business.id,
        owner_telegram_chat_id: primaryChatId,
        telegram_order_recipients: cleaned,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, recipients: cleaned });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сохранения" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const owned = await getOwnedBusiness(req);
    if (!owned) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const body = await req.json();
    const chatId = String(body.chatId || "").trim();
    const recipientName = String(body.name || "Менеджер").trim();

    if (!chatId) {
      return NextResponse.json({ error: "Укажите Telegram Chat ID" }, { status: 400 });
    }

    const sent = await sendTelegramMessage(
      chatId,
      `✅ <b>Тестовое уведомление TIYIN Space</b>\n\nПолучатель: <b>${recipientName}</b>\nКомпания: <b>${owned.business.name}</b>\n\nЗаказы и чеки Kaspi будут мгновенно приходить в этот чат!`
    );

    if (!sent) {
      return NextResponse.json(
        {
          error:
            "Не удалось отправить сообщение. Убедитесь, что этот человек нажал /start в боте @tiyinapp_bot и Chat ID указан верно.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка отправки теста" },
      { status: 500 }
    );
  }
}
