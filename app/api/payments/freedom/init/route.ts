import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function getBaseUrl(req: NextRequest): string {
  const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (envUrl.startsWith("https://") || envUrl.startsWith("http://")) {
    return envUrl.replace(/\/+$/, "");
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "tiyin.kz";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

function buildFreedomSignature(
  scriptName: string,
  params: Record<string, string>,
  secretKey: string
): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "pg_sig" && params[k] !== undefined && params[k] !== "")
    .sort();
  const parts = [scriptName, ...sortedKeys.map((k) => params[k]), secretKey];
  return crypto.createHash("md5").update(parts.join(";"), "utf8").digest("hex");
}

function extractXmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(re);
  return match ? match[1].trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId = String(body.orderId || "").trim();
    const orderCode = String(body.orderCode || "").trim();

    if (!orderId || !orderCode) {
      return NextResponse.json(
        { error: "Не указаны данные заказа для оплаты." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: order, error: ordErr } = await admin
      .from("orders")
      .select("id, order_code, business_id, total_price, client_phone")
      .eq("id", orderId)
      .eq("order_code", orderCode)
      .maybeSingle();

    if (ordErr || !order) {
      return NextResponse.json({ error: "Заказ не найден." }, { status: 404 });
    }

    const [bizRes, secRes] = await Promise.all([
      admin
        .from("businesses")
        .select("id, slug, name, freedom_api_enabled")
        .eq("id", order.business_id)
        .maybeSingle(),
      admin
        .from("business_payment_secrets")
        .select("freedom_merchant_id, freedom_secret_key, freedom_test_mode")
        .eq("business_id", order.business_id)
        .maybeSingle(),
    ]);

    const biz = bizRes.data;
    const secrets = secRes.data;

    if (
      !biz?.freedom_api_enabled ||
      !secrets?.freedom_merchant_id ||
      !secrets?.freedom_secret_key
    ) {
      return NextResponse.json(
        { error: "Freedom Pay не настроен для этого магазина." },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl(req);
    const encodedSlug = encodeURIComponent(biz.slug);
    const salt = crypto.randomBytes(12).toString("hex");

    const params: Record<string, string> = {
      pg_merchant_id: secrets.freedom_merchant_id,
      pg_order_id: order.order_code,
      pg_amount: String(order.total_price),
      pg_currency: "KZT",
      pg_description: `Заказ ${order.order_code} — ${biz.name}`,
      pg_salt: salt,
      pg_result_url: `${baseUrl}/api/payments/freedom/webhook`,
      pg_success_url: `${baseUrl}/${encodedSlug}?payment=success&order=${encodeURIComponent(
        order.order_code
      )}&provider=freedom`,
      pg_failure_url: `${baseUrl}/${encodedSlug}?payment=failed&order=${encodeURIComponent(
        order.order_code
      )}&provider=freedom`,
      pg_request_method: "POST",
      pg_testing_mode: secrets.freedom_test_mode ? "1" : "0",
      pg_language: "ru",
    };

    const cleanPhone = String(order.client_phone || "").replace(/\D/g, "");
    if (cleanPhone.length >= 10) {
      params.pg_user_phone = cleanPhone;
    }

    params.pg_sig = buildFreedomSignature(
      "init_payment.php",
      params,
      secrets.freedom_secret_key
    );

    const formBody = new URLSearchParams(params);
    const fpRes = await fetch("https://api.freedompay.kz/init_payment.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
      cache: "no-store",
    });

    const xmlText = await fpRes.text();
    const pgStatus = extractXmlTag(xmlText, "pg_status");
    const redirectUrl = extractXmlTag(xmlText, "pg_redirect_url");
    const paymentId = extractXmlTag(xmlText, "pg_payment_id");
    const errDesc = extractXmlTag(xmlText, "pg_error_description");

    if (pgStatus !== "ok" || !redirectUrl) {
      return NextResponse.json(
        {
          error:
            errDesc ||
            "Freedom Pay не смог создать платёж. Проверьте Merchant ID и Secret Key.",
        },
        { status: 502 }
      );
    }

    if (paymentId) {
      await admin
        .from("orders")
        .update({ payment_external_id: paymentId })
        .eq("id", order.id);
    }

    return NextResponse.json({
      ok: true,
      redirectUrl,
      paymentId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка инициализации Freedom Pay" },
      { status: 500 }
    );
  }
}
