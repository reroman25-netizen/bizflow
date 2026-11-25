import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptSecret } from "@/lib/secretCrypto";

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
      .select("id, order_code, business_id, total_price, client_phone, payment_external_id")
      .eq("id", orderId)
      .eq("order_code", orderCode)
      .maybeSingle();

    if (ordErr || !order) {
      return NextResponse.json({ error: "Заказ не найден." }, { status: 404 });
    }

    const [bizRes, secRes] = await Promise.all([
      admin
        .from("businesses")
        .select("id, slug, name, halyk_api_enabled")
        .eq("id", order.business_id)
        .maybeSingle(),
      admin
        .from("business_payment_secrets")
        .select("halyk_client_id, halyk_client_secret, halyk_terminal_id, halyk_test_mode")
        .eq("business_id", order.business_id)
        .maybeSingle(),
    ]);

    const biz = bizRes.data;
    const secrets = secRes.data;

    if (
      !biz?.halyk_api_enabled ||
      !secrets?.halyk_client_id ||
      !secrets?.halyk_client_secret ||
      !secrets?.halyk_terminal_id
    ) {
      return NextResponse.json(
        { error: "Halyk ePay не настроен для этого магазина." },
        { status: 400 }
      );
    }

    // Halyk ePay требует invoiceID строго из цифр (6–15 символов)
    const numericInvoiceId =
      order.payment_external_id && /^\d{6,15}$/.test(order.payment_external_id)
        ? order.payment_external_id
        : `${String(Date.now()).slice(-9)}${Math.floor(100 + Math.random() * 900)}`;

    if (numericInvoiceId !== order.payment_external_id) {
      await admin
        .from("orders")
        .update({ payment_external_id: numericInvoiceId })
        .eq("id", order.id);
    }

    const testMode = Boolean(secrets.halyk_test_mode);
    const oauthUrl = testMode
      ? "https://testoauth.homebank.kz/epay2/oauth2/token"
      : "https://epay-oauth.homebank.kz/oauth2/token";

    const scriptUrl = testMode
      ? "https://test-epay.homebank.kz/payform/payment-api.js"
      : "https://epay.homebank.kz/payform/payment-api.js";

    const baseUrl = getBaseUrl(req);
    const encodedSlug = encodeURIComponent(biz.slug);
    const backLink = `${baseUrl}/${encodedSlug}?payment=success&order=${encodeURIComponent(
      order.order_code
    )}&provider=halyk`;
    const failureBackLink = `${baseUrl}/${encodedSlug}?payment=failed&order=${encodeURIComponent(
      order.order_code
    )}&provider=halyk`;
    const postLink = `${baseUrl}/api/payments/halyk/webhook?orderId=${encodeURIComponent(
      order.id
    )}`;
    const failurePostLink = `${baseUrl}/api/payments/halyk/webhook?orderId=${encodeURIComponent(
      order.id
    )}&failed=1`;

    const form = new URLSearchParams();
    form.set("grant_type", "client_credentials");
    form.set(
      "scope",
      "payment"
    );
    form.set("client_id", secrets.halyk_client_id);
    form.set("client_secret", decryptSecret(secrets.halyk_client_secret));
    form.set("invoiceID", numericInvoiceId);
    form.set("amount", String(order.total_price));
    form.set("currency", "KZT");
    form.set("terminal", secrets.halyk_terminal_id);
    form.set("postLink", postLink);
    form.set("failurePostLink", failurePostLink);

    const tokenRes = await fetch(oauthUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });

    const tokenJson = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || !tokenJson?.access_token) {
      return NextResponse.json(
        {
          error:
            tokenJson?.error_description ||
            tokenJson?.message ||
            "Halyk ePay отклонил авторизацию. Проверьте Client ID, Client Secret и Terminal ID.",
        },
        { status: 502 }
      );
    }

    const paymentObject = {
      invoiceId: numericInvoiceId,
      invoiceIdAlt: order.order_code,
      backLink,
      failureBackLink,
      postLink,
      failurePostLink,
      language: "rus",
      description: `Заказ ${order.order_code} — ${biz.name}`,
      accountId: order.client_phone || order.order_code,
      terminal: secrets.halyk_terminal_id,
      amount: Number(order.total_price),
      currency: "KZT",
      phone: order.client_phone || "",
      auth: tokenJson,
    };

    return NextResponse.json({
      ok: true,
      testMode,
      scriptUrl,
      paymentObject,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка инициализации Halyk ePay" },
      { status: 500 }
    );
  }
}
