import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const businessId = String(body.businessId || "").trim();
    const rawCodes = Array.isArray(body.orderCodes) ? body.orderCodes : [];

    const orderCodes = rawCodes
      .map((c: unknown) => String(c || "").trim())
      .filter((c: string) => c.length >= 3 && c.length <= 32)
      .slice(0, 30);

    if (!businessId || orderCodes.length === 0) {
      return NextResponse.json({ ok: true, orders: [] });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("orders")
      .select(
        "id, order_code, status, payment_method, payment_status, delivery_method, total_price, items, receipt_url, created_at"
      )
      .eq("business_id", businessId)
      .in("order_code", orderCodes)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const orderRows = data || [];
    const orderIds = orderRows.map((o: { id: string }) => o.id);

    const deliveryByOrder = new Map<
      string,
      {
        id: string;
        status: string;
        courier_name: string;
        courier_phone: string;
        tracking_url: string;
      }
    >();

    if (orderIds.length > 0) {
      const { data: delivRows } = await admin
        .from("deliveries")
        .select("id, order_id, status, courier_name, courier_phone, tracking_url, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });

      for (const d of delivRows || []) {
        const oid = String(d.order_id);
        if (!deliveryByOrder.has(oid)) {
          deliveryByOrder.set(oid, {
            id: d.id,
            status: d.status,
            courier_name: d.courier_name || "",
            courier_phone: d.courier_phone || "",
            tracking_url: d.tracking_url || "",
          });
        }
      }
    }

    const enriched = orderRows.map((o: Record<string, unknown>) => ({
      ...o,
      delivery: deliveryByOrder.get(String(o.id)) || null,
    }));

    return NextResponse.json({ ok: true, orders: enriched });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка загрузки заказов" },
      { status: 500 }
    );
  }
}
