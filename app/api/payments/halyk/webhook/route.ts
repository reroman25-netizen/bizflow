import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptSecret } from "@/lib/secretCrypto";
import {
  notifyOwnerNewOrder,
  resolveOrderRecipientChatIds,
} from "@/lib/telegramNotify";

export const dynamic = "force-dynamic";

async function verifyHalykTransaction(params: {
  clientId: string;
  clientSecret: string;
  invoiceId: string;
  testMode: boolean;
}): Promise<boolean> {
  const oauthUrl = params.testMode
    ? "https://testoauth.homebank.kz/epay2/oauth2/token"
    : "https://epay-oauth.homebank.kz/oauth2/token";

  const statusUrl = params.testMode
    ? `https://testepay.homebank.kz/api/check-status/payment/transaction/${encodeURIComponent(
        params.invoiceId
      )}`
    : `https://epay-api.homebank.kz/check-status/payment/transaction/${encodeURIComponent(
        params.invoiceId
      )}`;

  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("scope", "payment");
  form.set("client_id", params.clientId);
  form.set("client_secret", params.clientSecret);

  const tokenRes = await fetch(oauthUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });

  if (!tokenRes.ok) return false;
  const tokenJson = await tokenRes.json().catch(() => null);
  const accessToken = tokenJson?.access_token;
  if (!accessToken) return false;

  const checkRes = await fetch(statusUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!checkRes.ok) return false;
  const checkJson = await checkRes.json().catch(() => null);
  const tx = checkJson?.transaction || checkJson;
  const statusName = String(tx?.statusName || tx?.status || "").toUpperCase();
  const resultCode = String(checkJson?.resultCode || tx?.code || "");

  return (
    statusName === "CHARGE" ||
    statusName === "AUTH" ||
    statusName === "PAID" ||
    resultCode === "00" ||
    resultCode === "100"
  );
}

export async function POST(req: NextRequest) {
  try {
    const queryOrderId = (req.nextUrl.searchParams.get("orderId") || "").trim();
    const isFailureLink = req.nextUrl.searchParams.get("failed") === "1";

    const payload = await req.json().catch(() => ({} as Record<string, unknown>));
    const invoiceId = String(payload.invoiceId || payload.invoiceID || "").trim();

    const admin = getSupabaseAdmin();

    let orderQuery = admin
      .from("orders")
      .select(
        "id, order_code, business_id, client_name, client_phone, comment, items, total_price, source, payment_method, delivery_method, delivery_fee, payment_status, payment_external_id, notified_at"
      );

    if (queryOrderId) {
      orderQuery = orderQuery.eq("id", queryOrderId);
    } else if (invoiceId) {
      orderQuery = orderQuery.eq("payment_external_id", invoiceId);
    } else {
      return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
    }

    const { data: order } = await orderQuery.maybeSingle();
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    if (isFailureLink) {
      if (order.payment_status !== "paid") {
        await admin
          .from("orders")
          .update({ payment_status: "failed" })
          .eq("id", order.id);
      }
      return NextResponse.json({ ok: true });
    }

    // Если заказ уже отмечен оплаченным — просто подтверждаем банку 200 OK
    if (order.payment_status === "paid") {
      return NextResponse.json({ ok: true, alreadyPaid: true });
    }

    const { data: secrets } = await admin
      .from("business_payment_secrets")
      .select("halyk_client_id, halyk_client_secret, halyk_test_mode")
      .eq("business_id", order.business_id)
      .maybeSingle();

    if (!secrets?.halyk_client_id || !secrets?.halyk_client_secret) {
      return NextResponse.json({ ok: false, error: "Secrets missing" }, { status: 400 });
    }

    const targetInvoiceId = invoiceId || order.payment_external_id;
    const isVerifiedPaid = targetInvoiceId
      ? await verifyHalykTransaction({
          clientId: secrets.halyk_client_id,
          clientSecret: decryptSecret(secrets.halyk_client_secret),
          invoiceId: targetInvoiceId,
          testMode: Boolean(secrets.halyk_test_mode),
        })
      : false;

    if (!isVerifiedPaid) {
      return NextResponse.json(
        { ok: false, error: "Payment not verified by Halyk API" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    await admin
      .from("orders")
      .update({
        payment_status: "paid",
        notified_at: nowIso,
      })
      .eq("id", order.id);

    if (!order.notified_at) {
      const [bizRes, chanRes] = await Promise.all([
        admin.from("businesses").select("name").eq("id", order.business_id).maybeSingle(),
        admin
          .from("business_channels")
          .select("owner_telegram_chat_id, telegram_order_recipients")
          .eq("business_id", order.business_id)
          .maybeSingle(),
      ]);

      const chatIds = resolveOrderRecipientChatIds(
        chanRes.data?.owner_telegram_chat_id,
        chanRes.data?.telegram_order_recipients
      );

      if (chatIds.length > 0) {
        await notifyOwnerNewOrder({
          chatIds,
          businessName: bizRes.data?.name || "TIYIN Space",
          orderId: order.id,
          orderCode: order.order_code,
          source: order.source || "web",
          clientName: order.client_name,
          clientPhone: order.client_phone,
          paymentMethod: "Halyk ePay",
          paymentStatusLabel: "ОПЛАЧЕНО ✅",
          deliveryMethod: order.delivery_method || "",
          deliveryFee: Number(order.delivery_fee || 0),
          comment: order.comment || "",
          items: Array.isArray(order.items) ? order.items : [],
          totalPrice: order.total_price,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Webhook error" },
      { status: 500 }
    );
  }
}
