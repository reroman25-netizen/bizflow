import { NextRequest, NextResponse } from "next/server";
import { verifyBusinessOwnerRequest } from "@/lib/supabaseAdmin";
import {
  calculateSubscription,
  SubscriptionChannelId,
} from "@/lib/subscriptionPlans";
import { notifySuperAdminSubscription } from "@/lib/telegramNotify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const check = await verifyBusinessOwnerRequest(req.headers.get("authorization"));
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const { admin, business } = check;
    const body = await req.json();
    const rawChannels = Array.isArray(body.channels) ? body.channels : [];
    const allowed: SubscriptionChannelId[] = ["web", "whatsapp", "instagram", "telegram"];
    const validChannels = rawChannels.filter((c: string): c is SubscriptionChannelId =>
      allowed.includes(c as SubscriptionChannelId)
    );

    if (validChannels.length === 0) {
      return NextResponse.json(
        { error: "Выберите хотя бы один канал для подключения" },
        { status: 400 }
      );
    }

    const calc = calculateSubscription(validChannels);
    const contactPhone = String(body.contactPhone || business.phone || business.whatsapp || "").trim();
    const comment = String(body.comment || "").trim();

    const { data, error } = await admin
      .from("subscription_requests")
      .insert({
        business_id: business.id,
        selected_channels: validChannels,
        monthly_price: calc.finalPrice,
        estimated_days: calc.estimatedDays,
        contact_phone: contactPhone,
        comment,
        status: "new",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await notifySuperAdminSubscription({
      businessName: business.name,
      businessSlug: business.slug,
      channels: calc.modules.map((m) => m.title),
      monthlyPrice: calc.finalPrice,
      estimatedDays: calc.estimatedDays,
      contactPhone,
      comment,
    });

    return NextResponse.json({ ok: true, request: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка отправки заявки" },
      { status: 500 }
    );
  }
}
