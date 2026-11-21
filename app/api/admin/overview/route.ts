import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const check = await verifyAdminRequest(req.headers.get("authorization"));
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const { admin } = check;

    const [bizRes, aiRes, chanRes, prodRes, reqRes] = await Promise.all([
      admin.from("businesses").select("*").order("created_at", { ascending: false }),
      admin.from("business_ai_configs").select("*"),
      admin.from("business_channels").select("*"),
      admin.from("products").select("*").order("created_at", { ascending: false }),
      admin
        .from("subscription_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const aiMap = new Map(
      (aiRes.data || []).map((a: { business_id: string }) => [a.business_id, a])
    );
    const chanMap = new Map(
      (chanRes.data || []).map((c: { business_id: string }) => [c.business_id, c])
    );
    const products = prodRes.data || [];

    const businessesList = bizRes.data || [];
    const bizNameMap = new Map(
      businessesList.map((b: { id: string; name: string; slug: string }) => [
        b.id,
        { name: b.name, slug: b.slug },
      ])
    );

    const businesses = businessesList.map((b: { id: string }) => ({
      business: b,
      aiConfig: aiMap.get(b.id) || {
        business_id: b.id,
        ai_enabled: true,
        status_label: "Подключен (настраивается администратором)",
        system_prompt: "",
        daily_notes: "",
      },
      channels: chanMap.get(b.id) || {
        business_id: b.id,
        web_enabled: true,
        whatsapp_enabled: false,
        instagram_enabled: false,
        telegram_enabled: false,
        owner_telegram_chat_id: "",
        whatsapp_instance_id: "",
        whatsapp_api_token: "",
        telegram_bot_token: "",
        instagram_page_id: "",
        instagram_access_token: "",
      },
      products: products.filter((p: { business_id: string }) => p.business_id === b.id),
    }));

    const subscriptionRequests = (reqRes.data || []).map(
      (r: { business_id: string; [key: string]: unknown }) => {
        const info = bizNameMap.get(r.business_id);
        return {
          ...r,
          business_name: info?.name || "Неизвестный бизнес",
          business_slug: info?.slug || "",
        };
      }
    );

    return NextResponse.json({ businesses, subscriptionRequests });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сервера" },
      { status: 500 }
    );
  }
}
