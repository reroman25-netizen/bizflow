import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { quoteDeliveryForOrder } from "@/lib/deliveryEngine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: userRes } = await admin.auth.getUser(token);
    if (!userRes.user) {
      return NextResponse.json({ error: "Недействительная сессия" }, { status: 401 });
    }

    const { data: biz } = await admin
      .from("businesses")
      .select("id")
      .eq("owner_id", userRes.user.id)
      .maybeSingle();

    if (!biz) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const body = await req.json();
    const orderId = String(body.orderId || "").trim();
    if (!orderId) {
      return NextResponse.json({ error: "Укажите orderId" }, { status: 400 });
    }

    const quote = await quoteDeliveryForOrder(orderId, biz.id);
    return NextResponse.json({ ok: true, quote });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка расчёта доставки" },
      { status: 400 }
    );
  }
}
