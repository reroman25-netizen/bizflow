import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ ai_enabled: false, status_label: "Не указан бизнес" });
    }

    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("business_ai_configs")
      .select("ai_enabled, status_label")
      .eq("business_id", businessId)
      .maybeSingle();

    return NextResponse.json({
      ai_enabled: data ? Boolean(data.ai_enabled) : true,
      status_label:
        data?.status_label || "Подключен (настраивается администратором)",
    });
  } catch {
    return NextResponse.json({
      ai_enabled: true,
      status_label: "Настраивается администратором",
    });
  }
}
