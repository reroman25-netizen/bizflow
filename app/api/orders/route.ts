import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  notifyOwnerNewOrder,
  resolveOrderRecipientChatIds,
} from "@/lib/telegramNotify";
import { evaluateClientDelivery } from "@/lib/deliveryPricing";

export const dynamic = "force-dynamic";

function isValidKzPhone(raw: string): boolean {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length === 11 && (digits.startsWith("77") || digits.startsWith("87"));
}

function detectProvider(paymentMethod: string): string {
  const low = paymentMethod.toLowerCase();
  if (low.includes("kaspi")) return "kaspi";
  if (low.includes("halyk")) return "halyk";
  if (low.includes("freedom")) return "freedom";
  return "cash";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      businessId,
      userId,
      clientName,
      clientPhone,
      comment,
      items,
      source,
      paymentMethod,
      deliveryMethod,
      deliveryAddress,
      termsAccepted,
    } = body;

    if (
      !businessId ||
      !clientName ||
      !clientPhone ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json({ error: "Заполните все поля заказа" }, { status: 400 });
    }

    const finalPayment = String(paymentMethod || "Согласуем с менеджером");
    const paymentProvider = detectProvider(finalPayment);
    const normalizedPhone = String(clientPhone).trim();

    if (paymentProvider === "kaspi" && !isValidKzPhone(normalizedPhone)) {
      return NextResponse.json(
        {
          error:
            "Для оплаты через Kaspi Pay введите корректный номер телефона Казахстана (+7 7XX XXX XX XX).",
        },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const productIds = items.map((i: { productId: string }) => i.productId);
    const [prodRes, bizRes, chanRes] = await Promise.all([
      admin
        .from("products")
        .select("id, name, price")
        .eq("business_id", businessId)
        .in("id", productIds),
      admin.from("businesses").select("name, halyk_api_enabled, freedom_api_enabled, delivery_enabled, delivery_pricing_mode, delivery_fixed_price, delivery_free_from, delivery_min_order, delivery_show_included_badge").eq("id", businessId).maybeSingle(),
      admin
        .from("business_channels")
        .select("owner_telegram_chat_id, telegram_order_recipients")
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    const productMap = new Map(
      (prodRes.data || []).map((p: { id: string; name: string; price: number }) => [
        p.id,
        { name: p.name, price: p.price },
      ])
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

    const itemsSubtotal = verifiedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const orderCode = "ORD-" + Math.floor(1000 + Math.random() * 9000);
    const orderSource = String(source || "web");
    const finalDelivery = String(deliveryMethod || "Самовывоз / Уточнить");
    const cleanDeliveryAddress = String(deliveryAddress || "").trim();

    let deliveryFee = 0;
    if (finalDelivery === "Доставка курьером" && bizRes.data?.delivery_enabled) {
      const evalDeliv = evaluateClientDelivery(bizRes.data, itemsSubtotal);
      if (evalDeliv.minOrderNotMet && evalDeliv.minOrderAmount) {
        return NextResponse.json(
          {
            error: `Доставка курьером доступна при заказе от ${evalDeliv.minOrderAmount} ₸.`,
          },
          { status: 400 }
        );
      }
      deliveryFee = evalDeliv.fee;
    }

    const totalPrice = itemsSubtotal + deliveryFee;

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

    const { data: createdOrder, error: orderErr } = await admin
      .from("orders")
      .insert({
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
        source: orderSource,
        payment_method: finalPayment,
        payment_provider: paymentProvider,
        payment_status: "unpaid",
        delivery_method: finalDelivery,
        delivery_fee: deliveryFee,
        delivery_address: cleanDeliveryAddress,
        terms_accepted_at: termsAccepted ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (orderErr) {
      return NextResponse.json({ error: orderErr.message }, { status: 500 });
    }

    const requiresOnlinePayment =
      (paymentProvider === "halyk" && Boolean(bizRes.data?.halyk_api_enabled)) ||
      (paymentProvider === "freedom" && Boolean(bizRes.data?.freedom_api_enabled));

    // Для онлайн-оплаты через Halyk ePay / Freedom Pay уведомление отправим мгновенно после подтверждения от банка (вебхука)
    if (!requiresOnlinePayment) {
      const recipientChatIds = resolveOrderRecipientChatIds(
        chanRes.data?.owner_telegram_chat_id,
        chanRes.data?.telegram_order_recipients
      );

      if (recipientChatIds.length > 0) {
        await notifyOwnerNewOrder({
          chatIds: recipientChatIds,
          businessName: bizRes.data?.name || "TIYIN Space",
          orderId: createdOrder?.id || "",
          orderCode,
          source: orderSource,
          clientName: String(clientName).trim(),
          clientPhone: normalizedPhone,
          paymentMethod: finalPayment,
          paymentStatusLabel:
            paymentProvider === "kaspi" ? "ожидает чек" : undefined,
          deliveryMethod: finalDelivery,
          deliveryFee,
          comment: String(comment || "").trim(),
          items: verifiedItems,
          totalPrice,
        });
      }

      if (createdOrder?.id) {
        await admin
          .from("orders")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", createdOrder.id);
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: createdOrder?.id || "",
      orderCode,
      totalPrice,
      deliveryFee,
      requiresOnlinePayment,
      paymentProvider,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сервера" },
      { status: 500 }
    );
  }
}
