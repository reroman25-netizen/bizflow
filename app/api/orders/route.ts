import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, userId, clientName, clientPhone, comment, items } = body;

    if (!businessId || !clientName || !clientPhone || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Заполните все поля заказа" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Подтягиваем реальные цены из базы (защита от подмены цены на клиенте)
    const productIds = items.map((i: { productId: string }) => i.productId);
    const { data: dbProducts } = await admin
      .from("products")
      .select("id, name, price")
      .eq("business_id", businessId)
      .in("id", productIds);

    const productMap = new Map(
      (dbProducts || []).map((p: { id: string; name: string; price: number }) => [p.id, { name: p.name, price: p.price }])
    );

    const verifiedItems = items
      .map((i: { productId: string; quantity: number }) => {
        const found = productMap.get(i.productId);
        if (!found) return null;
        const qty = Math.max(1, Number(i.quantity) || 1);
        return {
          productId: i.productId,
          name: found.name,
          price: found.price,
          quantity: qty,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (verifiedItems.length === 0) {
      return NextResponse.json({ error: "Товары не найдены" }, { status: 400 });
    }

    const totalPrice = verifiedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const orderCode = "ORD-" + Math.floor(1000 + Math.random() * 9000);

    // Обновляем или создаем клиента в базе бизнеса
    const normalizedPhone = String(clientPhone).trim();
    const { data: existingClient } = await admin
      .from("clients")
      .select("*")
      .eq("business_id", businessId)
      .eq("phone", normalizedPhone)
      .maybeSingle();

    let clientId: string | null = null;
    if (existingClient) {
      clientId = existingClient.id;
      await admin
        .from("clients")
        .update({
          name: String(clientName).trim(),
          orders_count: (existingClient.orders_count || 0) + 1,
          total_spent: (existingClient.total_spent || 0) + totalPrice,
          last_order_at: new Date().toISOString(),
        })
        .eq("id", existingClient.id);
    } else {
      const { data: newClient } = await admin
        .from("clients")
        .insert({
          business_id: businessId,
          user_id: userId || null,
          name: String(clientName).trim(),
          phone: normalizedPhone,
          orders_count: 1,
          total_spent: totalPrice,
          last_order_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      clientId = newClient?.id || null;
    }

    const { error: orderErr } = await admin.from("orders").insert({
      order_code: orderCode,
      business_id: businessId,
      client_id: clientId,
      user_id: userId || null,
      client_name: String(clientName).trim(),
      client_phone: normalizedPhone,
      comment: String(comment || "").trim(),
      items: verifiedItems,
      total_price: totalPrice,
      status: "new",
      payment_method: "Согласуем с менеджером",
    });

    if (orderErr) {
      return NextResponse.json({ error: orderErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, orderCode, totalPrice });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сервера" },
      { status: 500 }
    );
  }
}
