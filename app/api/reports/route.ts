import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { notifyAdminShopReport } from "@/lib/telegramNotify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const businessId = String(body.businessId || "").trim();
    const reason = String(body.reason || "").trim().slice(0, 120);
    const details = String(body.details || "").trim().slice(0, 1000);
    const orderCode = String(body.orderCode || "").trim().slice(0, 32);
    const reporterContact = String(body.reporterContact || "").trim().slice(0, 80);

    if (!businessId || !reason) {
      return NextResponse.json(
        { error: "Укажите причину обращения." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data: biz } = await admin
      .from("businesses")
      .select("id, name, slug")
      .eq("id", businessId)
      .maybeSingle();

    if (!biz) {
      return NextResponse.json({ error: "Компания не найдена." }, { status: 404 });
    }

    const { error } = await admin.from("shop_reports").insert({
      business_id: biz.id,
      business_slug: biz.slug,
      reason,
      details,
      order_code: orderCode,
      reporter_contact: reporterContact,
      status: "new",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await notifyAdminShopReport({
      businessName: biz.name,
      businessSlug: biz.slug,
      reason,
      details,
      orderCode,
      reporterContact,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка отправки жалобы" },
      { status: 500 }
    );
  }
}
