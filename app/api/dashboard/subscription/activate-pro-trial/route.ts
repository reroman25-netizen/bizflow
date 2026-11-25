import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { canActivateFreeProTrial, SAAS_PRO_TRIAL_DAYS } from "@/lib/proPlan";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes.user) {
      return NextResponse.json({ error: "Недействительная сессия" }, { status: 401 });
    }

    const { data: biz } = await admin
      .from("businesses")
      .select("id, plan_tier, pro_trial_used, pro_trial_ends_at, trial_ends_at, paid_until")
      .eq("owner_id", userRes.user.id)
      .maybeSingle();

    if (!biz) {
      return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
    }

    if (!canActivateFreeProTrial(biz)) {
      return NextResponse.json(
        { error: "Пробный период тарифа «Бизнес PRO» уже был использован или тариф уже активен." },
        { status: 400 }
      );
    }

    const endsAt = new Date(Date.now() + SAAS_PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { error: updErr } = await admin
      .from("businesses")
      .update({
        plan_tier: "pro",
        pro_trial_used: true,
        pro_trial_ends_at: endsAt,
        trial_ends_at: endsAt,
      })
      .eq("id", biz.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      plan_tier: "pro",
      pro_trial_used: true,
      pro_trial_ends_at: endsAt,
      trial_ends_at: endsAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка активации Бизнес PRO" },
      { status: 500 }
    );
  }
}
