import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/supabaseAdmin";
import { runBillingRemindersCheck } from "@/lib/billingReminders";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const check = await verifyAdminRequest(req.headers.get("authorization"));
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const { admin } = check;
    const body = await req.json();
    const { business, aiConfig, channels } = body;

    if (business?.id) {
      const updatePayload: Record<string, unknown> = {
        name: business.name,
        city: business.city || "Алматы",
        category: business.category || "Магазин / Бутик",
        tagline: business.tagline,
        services_description: business.services_description,
        address: business.address,
        working_hours: business.working_hours,
        phone: business.phone,
        whatsapp: business.whatsapp,
        telegram: business.telegram,
        kaspi_pay_link: business.kaspi_pay_link || "",
        halyk_enabled: Boolean(business.halyk_enabled),
        is_active: business.is_active,
      };

      if (typeof business.plan_tier === "string") {
        updatePayload.plan_tier = business.plan_tier;
      }
      if (typeof business.billing_note === "string") {
        updatePayload.billing_note = business.billing_note;
      }
      if (business.paid_until !== undefined) {
        updatePayload.paid_until = business.paid_until || null;
      }

      await admin.from("businesses").update(updatePayload).eq("id", business.id);
    }

    if (aiConfig?.business_id) {
      await admin.from("business_ai_configs").upsert(
        {
          business_id: aiConfig.business_id,
          ai_enabled: Boolean(aiConfig.ai_enabled),
          status_label: aiConfig.status_label || "Настраивается администратором",
          system_prompt: aiConfig.system_prompt || "",
          daily_notes: aiConfig.daily_notes || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );
    }

    if (channels?.business_id) {
      await admin.from("business_channels").upsert(
        {
          business_id: channels.business_id,
          web_enabled: Boolean(channels.web_enabled),
          whatsapp_enabled: Boolean(channels.whatsapp_enabled),
          instagram_enabled: Boolean(channels.instagram_enabled),
          telegram_enabled: Boolean(channels.telegram_enabled),
          owner_telegram_chat_id: String(channels.owner_telegram_chat_id || "").trim(),
          whatsapp_instance_id: String(channels.whatsapp_instance_id || "").trim(),
          whatsapp_api_token: String(channels.whatsapp_api_token || "").trim(),
          telegram_bot_token: String(channels.telegram_bot_token || "").trim(),
          instagram_page_id: String(channels.instagram_page_id || "").trim(),
          instagram_access_token: String(channels.instagram_access_token || "").trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );
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

    if (body.action === "update_subscription_status") {
      const { error } = await admin
        .from("subscription_requests")
        .update({ status: body.status })
        .eq("id", body.requestId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "extend_billing") {
      const businessId = String(body.businessId || "");
      const months = Math.max(1, Number(body.months) || 1);
      const amount = Math.max(0, Number(body.amount) || 0);
      const planTier =
        body.planTier === "ai_autopilot" ? "ai_autopilot" : "base";
      const comment = String(body.comment || "").trim();

      const { data: biz, error: bizErr } = await admin
        .from("businesses")
        .select("id, created_at, trial_ends_at, paid_until, plan_tier")
        .eq("id", businessId)
        .single();

      if (bizErr || !biz) {
        return NextResponse.json(
          { error: bizErr?.message || "Компания не найдена" },
          { status: 404 }
        );
      }

      const now = new Date();
      let baseDate = now;

      if (biz.trial_ends_at) {
        const t = new Date(biz.trial_ends_at);
        if (t.getTime() > baseDate.getTime()) baseDate = t;
      }
      if (biz.paid_until) {
        const p = new Date(biz.paid_until);
        if (p.getTime() > baseDate.getTime()) baseDate = p;
      }

      const nextPaidUntil = new Date(baseDate);
      nextPaidUntil.setMonth(nextPaidUntil.getMonth() + months);
      const nextPaidIso = nextPaidUntil.toISOString();

      const { data: updatedBiz, error: updErr } = await admin
        .from("businesses")
        .update({
          paid_until: nextPaidIso,
          plan_tier: planTier,
          billing_note:
            comment ||
            `Продлено на ${months} мес. (${new Intl.NumberFormat("ru-RU").format(amount)} ₸)`,
        })
        .eq("id", businessId)
        .select()
        .single();

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      await admin.from("billing_payments").insert({
        business_id: businessId,
        amount,
        months,
        plan_tier: planTier,
        comment:
          comment ||
          `Продление (${planTier === "ai_autopilot" ? "TIYIN AI" : "База"}, ${months} мес.)`,
      });

      return NextResponse.json({ ok: true, business: updatedBiz });
    }

    if (body.action === "run_billing_reminders") {
      const result = await runBillingRemindersCheck(admin, {
        includeAllExpiringForAdmin: true,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сервера" },
      { status: 500 }
    );
  }
}
