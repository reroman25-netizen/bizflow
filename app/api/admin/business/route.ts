import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const check = await verifyAdminRequest(req.headers.get("authorization"));
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const { admin } = check;
    const body = await req.json();
    const { business, aiConfig } = body;

    if (business?.id) {
      await admin
        .from("businesses")
        .update({
          name: business.name,
          city: business.city || "Алматы",
          tagline: business.tagline,
          services_description: business.services_description,
          address: business.address,
          working_hours: business.working_hours,
          phone: business.phone,
          whatsapp: business.whatsapp,
          telegram: business.telegram,
          is_active: business.is_active,
        })
        .eq("id", business.id);
    }

    if (aiConfig?.business_id) {
      await admin.from("business_ai_configs").upsert({
        business_id: aiConfig.business_id,
        ai_enabled: Boolean(aiConfig.ai_enabled),
        status_label: aiConfig.status_label || "Настраивается администратором",
        system_prompt: aiConfig.system_prompt || "",
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сохранения" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const check = await verifyAdminRequest(req.headers.get("authorization"));
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const { admin } = check;
    const body = await req.json();

    if (body.action === "add_product") {
      const { data, error } = await admin
        .from("products")
        .insert({
          business_id: body.businessId,
          name: body.name,
          price: Number(body.price) || 0,
          category: body.category || "Услуги",
          description: body.description || "",
          is_available: true,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, product: data });
    }

    if (body.action === "delete_product") {
      const { error } = await admin
        .from("products")
        .delete()
        .eq("id", body.productId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сервера" },
      { status: 500 }
    );
  }
}
