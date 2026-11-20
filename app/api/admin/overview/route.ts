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

    const [bizRes, aiRes, prodRes] = await Promise.all([
      admin.from("businesses").select("*").order("created_at", { ascending: false }),
      admin.from("business_ai_configs").select("*"),
      admin.from("products").select("*").order("created_at", { ascending: false }),
    ]);

    const aiMap = new Map((aiRes.data || []).map((a: { business_id: string }) => [a.business_id, a]));
    const products = prodRes.data || [];

    const businesses = (bizRes.data || []).map((b: { id: string }) => ({
      business: b,
      aiConfig: aiMap.get(b.id) || {
        business_id: b.id,
        ai_enabled: true,
        status_label: "Подключен (настраивается администратором)",
        system_prompt: "",
      },
      products: products.filter((p: { business_id: string }) => p.business_id === b.id),
    }));

    return NextResponse.json({ businesses });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сервера" },
      { status: 500 }
    );
  }
}
