import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptSecret } from "@/lib/secretCrypto";
import { hasActiveProAccess } from "@/lib/proPlan";

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
    .select(
      "id, name, slug, phone, address, city, plan_tier, trial_ends_at, pro_trial_ends_at, paid_until, pro_trial_used, delivery_enabled, delivery_api_enabled, delivery_pricing_mode, delivery_fixed_price, delivery_free_from, delivery_min_order, delivery_show_included_badge, delivery_pickup_address, delivery_pickup_lat, delivery_pickup_lng, delivery_pickup_entrance, delivery_pickup_phone, delivery_pickup_comment"
    )
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
    const { data: sec } = await admin
      .from("business_delivery_secrets")
      .select("yandex_api_token, yandex_test_mode")
      .eq("business_id", business.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      hasProAccess: hasActiveProAccess(business),
      settings: {
        delivery_enabled: Boolean(business.delivery_enabled),
        delivery_api_enabled: Boolean(business.delivery_api_enabled),
        yandex_has_token: Boolean(sec?.yandex_api_token),
        yandex_test_mode: Boolean(sec?.yandex_test_mode),
        delivery_pricing_mode:
          business.delivery_pricing_mode === "included" ? "included" : "fixed",
        delivery_fixed_price: Number(business.delivery_fixed_price || 0),
        delivery_free_from: business.delivery_free_from ?? null,
        delivery_min_order: business.delivery_min_order ?? null,
        delivery_show_included_badge: business.delivery_show_included_badge !== false,
        delivery_pickup_address:
          business.delivery_pickup_address ||
          [business.city, business.address].filter(Boolean).join(", "),
        delivery_pickup_lat: business.delivery_pickup_lat ?? null,
        delivery_pickup_lng: business.delivery_pickup_lng ?? null,
        delivery_pickup_entrance: business.delivery_pickup_entrance || "",
        delivery_pickup_phone: business.delivery_pickup_phone || business.phone || "",
        delivery_pickup_comment: business.delivery_pickup_comment || "",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка загрузки настроек доставки" },
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
    const proActive = hasActiveProAccess(business);

    const deliveryEnabled = Boolean(body.delivery_enabled);
    const wantYandexApi = Boolean(body.delivery_api_enabled);
    const incomingToken = String(body.yandex_api_token || "").trim();
    const yandexTestMode = Boolean(body.yandex_test_mode);

    if (wantYandexApi && !proActive) {
      return NextResponse.json(
        {
          error:
            "API-вызов курьеров Яндекс Доставки доступен на тарифе «Бизнес PRO» (4 990 ₸/мес, 1 месяц бесплатно).",
        },
        { status: 403 }
      );
    }

    const { data: existingSec } = await admin
      .from("business_delivery_secrets")
      .select("yandex_api_token")
      .eq("business_id", business.id)
      .maybeSingle();

    const nextEncryptedToken = incomingToken
      ? encryptSecret(incomingToken)
      : existingSec?.yandex_api_token || "";

    if (wantYandexApi && !nextEncryptedToken) {
      return NextResponse.json(
        { error: "Чтобы включить API Яндекс Доставки, вставьте ваш API-токен из кабинета Яндекса." },
        { status: 400 }
      );
    }

    const pricingMode = body.delivery_pricing_mode === "included" ? "included" : "fixed";
    const fixedPrice = Math.max(0, Math.round(Number(body.delivery_fixed_price || 0)));
    const rawFreeFrom = Number(body.delivery_free_from || 0);
    const freeFrom = rawFreeFrom > 0 ? Math.round(rawFreeFrom) : null;
    const rawMinOrder = Number(body.delivery_min_order || 0);
    const minOrder = rawMinOrder > 0 ? Math.round(rawMinOrder) : null;
    const showIncludedBadge = body.delivery_show_included_badge !== false;

    const pickupAddress = String(body.delivery_pickup_address || "").trim();
    const pickupEntrance = String(body.delivery_pickup_entrance || "").trim();
    const pickupPhone = String(body.delivery_pickup_phone || "").trim();
    const pickupComment = String(body.delivery_pickup_comment || "").trim();

    const latVal =
      body.delivery_pickup_lat !== null &&
      body.delivery_pickup_lat !== undefined &&
      String(body.delivery_pickup_lat).trim() !== ""
        ? Number(body.delivery_pickup_lat)
        : null;
    const lngVal =
      body.delivery_pickup_lng !== null &&
      body.delivery_pickup_lng !== undefined &&
      String(body.delivery_pickup_lng).trim() !== ""
        ? Number(body.delivery_pickup_lng)
        : null;

    if (wantYandexApi && !pickupAddress) {
      return NextResponse.json(
        { error: "Для работы Яндекс Курьера укажите адрес забора заказов." },
        { status: 400 }
      );
    }

    if (incomingToken || existingSec) {
      await admin.from("business_delivery_secrets").upsert(
        {
          business_id: business.id,
          yandex_api_token: nextEncryptedToken,
          yandex_test_mode: yandexTestMode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );
    }

    const updatePayload = {
      delivery_enabled: deliveryEnabled,
      delivery_api_enabled: proActive ? wantYandexApi : false,
      delivery_pricing_mode: pricingMode,
      delivery_fixed_price: fixedPrice,
      delivery_free_from: freeFrom,
      delivery_min_order: minOrder,
      delivery_show_included_badge: showIncludedBadge,
      delivery_pickup_address: pickupAddress,
      delivery_pickup_lat: Number.isFinite(latVal) ? latVal : null,
      delivery_pickup_lng: Number.isFinite(lngVal) ? lngVal : null,
      delivery_pickup_entrance: pickupEntrance,
      delivery_pickup_phone: pickupPhone,
      delivery_pickup_comment: pickupComment,
    };

    const { error } = await admin
      .from("businesses")
      .update(updatePayload)
      .eq("id", business.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      settings: {
        ...updatePayload,
        yandex_has_token: Boolean(nextEncryptedToken),
        yandex_test_mode: yandexTestMode,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка сохранения настроек доставки" },
      { status: 500 }
    );
  }
}
