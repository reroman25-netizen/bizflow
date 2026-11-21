import { NextRequest, NextResponse } from "next/server";
import { verifyBusinessOwnerRequest } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const check = await verifyBusinessOwnerRequest(req.headers.get("authorization"));
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const { admin, business } = check;
    const conversationId = req.nextUrl.searchParams.get("conversationId");

    if (conversationId) {
      const { data: msgs } = await admin
        .from("messages")
        .select("*")
        .eq("business_id", business.id)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(60);
      return NextResponse.json({ messages: msgs || [] });
    }

    const [aiRes, chanRes, convRes, reqRes] = await Promise.all([
      admin
        .from("business_ai_configs")
        .select("ai_enabled, status_label, daily_notes")
        .eq("business_id", business.id)
        .maybeSingle(),
      admin
        .from("business_channels")
        .select(
          "business_id, web_enabled, whatsapp_enabled, instagram_enabled, telegram_enabled, owner_telegram_chat_id"
        )
        .eq("business_id", business.id)
        .maybeSingle(),
      admin
        .from("conversations")
        .select("*")
        .eq("business_id", business.id)
        .order("last_message_at", { ascending: false })
        .limit(40),
      admin
        .from("subscription_requests")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return NextResponse.json({
      aiConfig: {
        ai_enabled: aiRes.data ? Boolean(aiRes.data.ai_enabled) : true,
        status_label: aiRes.data?.status_label || "Настраивается администратором",
        daily_notes: aiRes.data?.daily_notes || "",
      },
      channels: chanRes.data || {
        business_id: business.id,
        web_enabled: true,
        whatsapp_enabled: false,
        instagram_enabled: false,
        telegram_enabled: false,
        owner_telegram_chat_id: "",
      },
      conversations: convRes.data || [],
      subscriptionRequests: reqRes.data || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const check = await verifyBusinessOwnerRequest(req.headers.get("authorization"));
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const { admin, business } = check;
    const body = await req.json();

    if (typeof body.dailyNotes === "string") {
      await admin.from("business_ai_configs").upsert(
        {
          business_id: business.id,
          daily_notes: body.dailyNotes.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );
    }

    if (typeof body.ownerTelegramChatId === "string") {
      await admin.from("business_channels").upsert(
        {
          business_id: business.id,
          owner_telegram_chat_id: body.ownerTelegramChatId.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );
    }

    if (body.conversationId && typeof body.aiPaused === "boolean") {
      await admin
        .from("conversations")
        .update({ ai_paused: body.aiPaused })
        .eq("id", body.conversationId)
        .eq("business_id", business.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сохранения" },
      { status: 500 }
    );
  }
}
