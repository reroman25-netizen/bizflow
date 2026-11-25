import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptSecret } from "@/lib/secretCrypto";
import {
  notifyOwnerNewOrder,
  resolveOrderRecipientChatIds,
} from "@/lib/telegramNotify";

export const dynamic = "force-dynamic";

function buildFreedomSignature(
  scriptName: string,
  params: Record<string, string>,
  secretKey: string
): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "pg_sig" && params[k] !== undefined)
    .sort();
  const parts = [scriptName, ...sortedKeys.map((k) => params[k]), secretKey];
  return crypto.createHash("md5").update(parts.join(";"), "utf8").digest("hex");
}

function xmlResponse(status: "ok" | "error" | "rejected", description: string, secretKey?: string) {
  const salt = crypto.randomBytes(8).toString("hex");
  const respParams: Record<string, string> = {
    pg_status: status,
    pg_description: description,
    pg_salt: salt,
  };
  const sig = secretKey ? buildFreedomSignature("webhook", respParams, secretKey) : "";
  const xml = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<response>`,
    `<pg_status>${status}</pg_status>`,
    `<pg_description>${description}</pg_description>`,
    `<pg_salt>${salt}</pg_salt>`,
    sig ? `<pg_sig>${sig}</pg_sig>` : "",
    `</response>`,
  ]
    .filter(Boolean)
    .join("");

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

async function parseFreedomBody(req: NextRequest): Promise<Record<string, string>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  const result: Record<string, string> = {};

  if (ct.includes("application/json")) {
    const json = await req.json().catch(() => ({}));
    for (const [k, v] of Object.entries(json || {})) {
      result[k] = String(v ?? "");
    }
    return result;
  }

  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    fd.forEach((v, k) => {
      result[k] = String(v);
    });
    return result;
  }

  const rawText = await req.text();
  const sp = new URLSearchParams(rawText);
  sp.forEach((v, k) => {
    result[k] = v;
  });
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const params = await parseFreedomBody(req);
    const pgOrderId = (params.pg_order_id || "").trim();
    const pgPaymentId = (params.pg_payment_id || "").trim();
    const pgResult = (params.pg_result || "").trim();
    const pgSig = (params.pg_sig || "").trim().toLowerCase();

    if (!pgOrderId && !pgPaymentId) {
      return xmlResponse("error", "Missing order identifier");
    }

    const admin = getSupabaseAdmin();

    let orderQuery = admin
      .from("orders")
      .select(
        "id, order_code, business_id, client_name, client_phone, comment, items, total_price, source, payment_method, delivery_method, delivery_fee, payment_status, notified_at"
      );

    if (pgOrderId) {
      orderQuery = orderQuery.eq("order_code", pgOrderId);
    } else {
      orderQuery = orderQuery.eq("payment_external_id", pgPaymentId);
    }

    const { data: order } = await orderQuery.maybeSingle();
    if (!order) {
      return xmlResponse("rejected", "Order not found");
    }

    const { data: secrets } = await admin
      .from("business_payment_secrets")
      .select("freedom_secret_key")
      .eq("business_id", order.business_id)
      .maybeSingle();

    const secretKey = decryptSecret(secrets?.freedom_secret_key);
    if (!secretKey) {
      return xmlResponse("error", "Merchant secret not configured");
    }

    // Проверяем подпись Freedom Pay
    const expectedSig = buildFreedomSignature("webhook", params, secretKey).toLowerCase();
    const sigValid =
      pgSig.length === expectedSig.length &&
      pgSig.length > 0 &&
      crypto.timingSafeEqual(Buffer.from(pgSig), Buffer.from(expectedSig));

    if (!sigValid) {
      return xmlResponse("error", "Invalid signature", secretKey);
    }

    if (pgResult !== "1") {
      if (order.payment_status !== "paid") {
        await admin
          .from("orders")
          .update({ payment_status: "failed" })
          .eq("id", order.id);
      }
      return xmlResponse("ok", "Failure recorded", secretKey);
    }

    if (order.payment_status === "paid") {
      return xmlResponse("ok", "Already paid", secretKey);
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
          paymentMethod: "Freedom Pay",
          paymentStatusLabel: "ОПЛАЧЕНО ✅",
          deliveryMethod: order.delivery_method || "",
          deliveryFee: Number(order.delivery_fee || 0),
          comment: order.comment || "",
          items: Array.isArray(order.items) ? order.items : [],
          totalPrice: order.total_price,
        });
      }
    }

    return xmlResponse("ok", "Payment accepted", secretKey);
  } catch (err) {
    return xmlResponse(
      "error",
      err instanceof Error ? err.message : "Server error"
    );
  }
}
