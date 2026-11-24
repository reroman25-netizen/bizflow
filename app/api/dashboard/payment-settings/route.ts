import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getOwnedBusiness(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes.user) return null;

  const { data: biz } = await admin
    .from("businesses")
    .select("id, kaspi_pay_link, halyk_enabled, halyk_api_enabled, freedom_api_enabled")
    .eq("owner_id", userRes.user.id)
    .maybeSingle();

  if (!biz) return null;
  return { admin, business: biz };
}

export async function GET(req: NextRequest) {
  try {
    const owned = await getOwnedBusiness(req);
    if (!owned) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const { admin, business } = owned;
    const { data: secrets } = await admin
      .from("business_payment_secrets")
      .select(
        "halyk_client_id, halyk_client_secret, halyk_terminal_id, halyk_test_mode, freedom_merchant_id, freedom_secret_key, freedom_test_mode"
      )
      .eq("business_id", business.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      settings: {
        kaspi_pay_link: business.kaspi_pay_link || "",
        halyk_enabled: Boolean(business.halyk_enabled),
        halyk_api_enabled: Boolean(business.halyk_api_enabled),
        halyk_client_id: secrets?.halyk_client_id || "",
        halyk_terminal_id: secrets?.halyk_terminal_id || "",
        halyk_has_secret: Boolean(secrets?.halyk_client_secret),
        halyk_test_mode: secrets?.halyk_test_mode ?? true,
        freedom_api_enabled: Boolean(business.freedom_api_enabled),
        freedom_merchant_id: secrets?.freedom_merchant_id || "",
        freedom_has_secret: Boolean(secrets?.freedom_secret_key),
        freedom_test_mode: secrets?.freedom_test_mode ?? true,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка загрузки настроек оплаты" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const owned = await getOwnedBusiness(req);
    if (!owned) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const body = await req.json();
    const { admin, business } = owned;

    const { data: existingSecrets } = await admin
      .from("business_payment_secrets")
      .select("*")
      .eq("business_id", business.id)
      .maybeSingle();

    const nextHalykClientId = String(body.halyk_client_id ?? existingSecrets?.halyk_client_id ?? "").trim();
    const nextHalykTerminalId = String(body.halyk_terminal_id ?? existingSecrets?.halyk_terminal_id ?? "").trim();
    const incomingHalykSecret = String(body.halyk_client_secret || "").trim();
    const nextHalykSecret = incomingHalykSecret || existingSecrets?.halyk_client_secret || "";
    const nextHalykTestMode = Boolean(body.halyk_test_mode ?? existingSecrets?.halyk_test_mode ?? true);

    const nextFreedomMerchantId = String(body.freedom_merchant_id ?? existingSecrets?.freedom_merchant_id ?? "").trim();
    const incomingFreedomSecret = String(body.freedom_secret_key || "").trim();
    const nextFreedomSecret = incomingFreedomSecret || existingSecrets?.freedom_secret_key || "";
    const nextFreedomTestMode = Boolean(body.freedom_test_mode ?? existingSecrets?.freedom_test_mode ?? true);

    const wantHalykApi = Boolean(body.halyk_api_enabled);
    const wantFreedomApi = Boolean(body.freedom_api_enabled);

    if (wantHalykApi && (!nextHalykClientId || !nextHalykSecret || !nextHalykTerminalId)) {
      return NextResponse.json(
        {
          error:
            "Чтобы включить Halyk ePay, заполните Client ID, Client Secret и Terminal ID.",
        },
        { status: 400 }
      );
    }

    if (wantFreedomApi && (!nextFreedomMerchantId || !nextFreedomSecret)) {
      return NextResponse.json(
        {
          error:
            "Чтобы включить Freedom Pay, заполните Merchant ID и Secret Key.",
        },
        { status: 400 }
      );
    }

    const { error: secretErr } = await admin
      .from("business_payment_secrets")
      .upsert(
        {
          business_id: business.id,
          halyk_client_id: nextHalykClientId,
          halyk_client_secret: nextHalykSecret,
          halyk_terminal_id: nextHalykTerminalId,
          halyk_test_mode: nextHalykTestMode,
          freedom_merchant_id: nextFreedomMerchantId,
          freedom_secret_key: nextFreedomSecret,
          freedom_test_mode: nextFreedomTestMode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

    if (secretErr) {
      return NextResponse.json({ error: secretErr.message }, { status: 500 });
    }

    const kaspiPayLink = String(body.kaspi_pay_link ?? business.kaspi_pay_link ?? "").trim();
    const halykManualEnabled = Boolean(body.halyk_enabled ?? business.halyk_enabled);

    const { error: bizErr } = await admin
      .from("businesses")
      .update({
        kaspi_pay_link: kaspiPayLink,
        halyk_enabled: halykManualEnabled,
        halyk_api_enabled: wantHalykApi,
        freedom_api_enabled: wantFreedomApi,
      })
      .eq("id", business.id);

    if (bizErr) {
      return NextResponse.json({ error: bizErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      settings: {
        kaspi_pay_link: kaspiPayLink,
        halyk_enabled: halykManualEnabled,
        halyk_api_enabled: wantHalykApi,
        halyk_client_id: nextHalykClientId,
        halyk_terminal_id: nextHalykTerminalId,
        halyk_has_secret: Boolean(nextHalykSecret),
        halyk_test_mode: nextHalykTestMode,
        freedom_api_enabled: wantFreedomApi,
        freedom_merchant_id: nextFreedomMerchantId,
        freedom_has_secret: Boolean(nextFreedomSecret),
        freedom_test_mode: nextFreedomTestMode,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сохранения настроек оплаты" },
      { status: 500 }
    );
  }
}
