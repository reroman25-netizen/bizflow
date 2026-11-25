import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptSecret } from "@/lib/secretCrypto";
import { hasActiveProAccess } from "@/lib/proPlan";
import {
  YandexApiError,
  YandexCredentials,
  acceptYandexClaim,
  cancelYandexClaim,
  createYandexClaim,
  estimateYandexDelivery,
  extractTrackingUrl,
  geocodeAddressKz,
  getYandexClaimInfo,
  mapYandexStatusToLocal,
} from "@/lib/yandexDelivery";
import {
  notifyDeliveryStatusUpdate,
  resolveOrderRecipientChatIds,
} from "@/lib/telegramNotify";
import { DeliveryStatus } from "@/lib/types";

const BACKOFF_SECONDS = [15, 45, 120, 300, 600];
const MAX_AUTO_PRICE_SURGE_RATIO = 1.25;

interface DeliveryRow {
  id: string;
  order_id: string;
  business_id: string;
  provider: string;
  idempotency_key: string;
  external_claim_id: string;
  yandex_version: number;
  status: string;
  provider_price: number;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  courier_name: string;
  courier_phone: string;
  tracking_url: string;
  last_error: string;
}

async function logDeliveryEvent(params: {
  deliveryId: string;
  eventType: string;
  statusFrom?: string;
  statusTo?: string;
  payload?: Record<string, unknown>;
}) {
  const admin = getSupabaseAdmin();
  await admin.from("delivery_events").insert({
    delivery_id: params.deliveryId,
    event_type: params.eventType,
    status_from: params.statusFrom || "",
    status_to: params.statusTo || "",
    payload: params.payload || {},
  });
}

async function getBusinessYandexCredentials(businessId: string): Promise<YandexCredentials> {
  const admin = getSupabaseAdmin();
  const [bizRes, secRes] = await Promise.all([
    admin
      .from("businesses")
      .select("plan_tier, trial_ends_at, pro_trial_ends_at, paid_until, delivery_api_enabled")
      .eq("id", businessId)
      .maybeSingle(),
    admin
      .from("business_delivery_secrets")
      .select("yandex_api_token, yandex_test_mode")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const biz = bizRes.data;
  if (!biz || !hasActiveProAccess(biz)) {
    throw new Error(
      "API-вызов курьеров Яндекс Доставки доступен на тарифе «Бизнес PRO» (4 990 ₸/мес, 1 месяц бесплатно)."
    );
  }
  if (!biz.delivery_api_enabled) {
    throw new Error(
      "Включите API-интеграцию Яндекс Доставки в Настройках → Доставка и Яндекс Курьер."
    );
  }

  const token = decryptSecret(secRes.data?.yandex_api_token);
  if (!token) {
    throw new Error(
      "Укажите ваш API-токен Яндекс Доставки для бизнеса в Настройках → Доставка и Яндекс Курьер."
    );
  }

  return {
    apiToken: token,
    testMode: Boolean(secRes.data?.yandex_test_mode),
  };
}

async function resolvePointsForOrder(orderId: string, businessId: string) {
  const admin = getSupabaseAdmin();
  const creds = await getBusinessYandexCredentials(businessId);

  const [orderRes, bizRes] = await Promise.all([
    admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("business_id", businessId)
      .maybeSingle(),
    admin
      .from("businesses")
      .select(
        "id, name, city, address, phone, delivery_pickup_address, delivery_pickup_lat, delivery_pickup_lng, delivery_pickup_entrance, delivery_pickup_phone, delivery_pickup_comment"
      )
      .eq("id", businessId)
      .maybeSingle(),
  ]);

  const order = orderRes.data;
  const business = bizRes.data;
  if (!order) throw new Error("Заказ не найден.");
  if (!business) throw new Error("Компания не найдена.");

  const pickupAddress = (
    business.delivery_pickup_address ||
    [business.city, business.address].filter(Boolean).join(", ")
  ).trim();
  if (!pickupAddress) {
    throw new Error("Заполните адрес забора в Настройках → Доставка и Яндекс Курьер.");
  }

  let pickupLat = business.delivery_pickup_lat as number | null;
  let pickupLng = business.delivery_pickup_lng as number | null;
  if (pickupLat == null || pickupLng == null) {
    const geoA = await geocodeAddressKz(pickupAddress, business.city || "Алматы");
    if (!geoA) {
      throw new Error(
        "Не удалось определить координаты точки забора. Нажмите «Определить по GPS» в Настройках → Доставка."
      );
    }
    pickupLat = geoA.lat;
    pickupLng = geoA.lng;
    await admin
      .from("businesses")
      .update({ delivery_pickup_lat: pickupLat, delivery_pickup_lng: pickupLng })
      .eq("id", business.id);
  }

  let dropoffAddress = String(order.delivery_address || "").trim();
  if (!dropoffAddress && order.comment) {
    const match = String(order.comment).match(/Адрес доставки:\s*([^|]+)/i);
    if (match) dropoffAddress = match[1].trim();
  }
  if (!dropoffAddress) {
    throw new Error("В этом заказе не указан адрес доставки клиента.");
  }

  const geoB = await geocodeAddressKz(dropoffAddress, business.city || "Алматы");
  if (!geoB) {
    throw new Error(
      `Не удалось найти на карте адрес клиента: «${dropoffAddress}». Уточните улицу и номер дома.`
    );
  }

  return {
    creds,
    order,
    business,
    pickup: {
      lat: pickupLat,
      lng: pickupLng,
      address: pickupAddress,
      entrance: business.delivery_pickup_entrance || "",
      phone: business.delivery_pickup_phone || business.phone || "",
      comment: business.delivery_pickup_comment || "",
    },
    dropoff: {
      lat: geoB.lat,
      lng: geoB.lng,
      address: geoB.fullname || dropoffAddress,
    },
  };
}

export async function quoteDeliveryForOrder(orderId: string, businessId: string) {
  const ctx = await resolvePointsForOrder(orderId, businessId);
  const estimate = await estimateYandexDelivery(ctx.creds, {
    pickup: ctx.pickup,
    dropoff: ctx.dropoff,
  });

  return {
    orderId: ctx.order.id,
    orderCode: ctx.order.order_code,
    paymentMethod: ctx.order.payment_method,
    paymentStatus: ctx.order.payment_status,
    pickupAddress: ctx.pickup.address,
    dropoffAddress: ctx.dropoff.address,
    providerPrice: estimate.price,
    etaMinutes: estimate.etaMinutes,
  };
}

export async function dispatchCourierForOrder(params: {
  orderId: string;
  businessId: string;
  confirmedPrice?: number;
}) {
  const admin = getSupabaseAdmin();

  const { data: existingActive } = await admin
    .from("deliveries")
    .select("*")
    .eq("order_id", params.orderId)
    .not("status", "in", "(cancelled,failed)")
    .maybeSingle();

  if (existingActive) {
    return { delivery: existingActive, alreadyExisted: true };
  }

  const ctx = await resolvePointsForOrder(params.orderId, params.businessId);
  const estimate = await estimateYandexDelivery(ctx.creds, {
    pickup: ctx.pickup,
    dropoff: ctx.dropoff,
  });

  if (
    params.confirmedPrice &&
    estimate.price > Math.round(params.confirmedPrice * MAX_AUTO_PRICE_SURGE_RATIO)
  ) {
    throw new Error(
      `Тариф Яндекса вырос с ${params.confirmedPrice} ₸ до ${estimate.price} ₸ из-за спроса. Запросите расчёт заново.`
    );
  }

  const { data: delivery, error: insertErr } = await admin
    .from("deliveries")
    .insert({
      order_id: ctx.order.id,
      business_id: ctx.business.id,
      provider: "yandex",
      status: "queued",
      provider_price: estimate.price,
      pickup_address: ctx.pickup.address,
      pickup_lat: ctx.pickup.lat,
      pickup_lng: ctx.pickup.lng,
      dropoff_address: ctx.dropoff.address,
      dropoff_lat: ctx.dropoff.lat,
      dropoff_lng: ctx.dropoff.lng,
    })
    .select("*")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      const { data: raced } = await admin
        .from("deliveries")
        .select("*")
        .eq("order_id", params.orderId)
        .not("status", "in", "(cancelled,failed)")
        .maybeSingle();
      if (raced) return { delivery: raced, alreadyExisted: true };
    }
    throw new Error(insertErr.message);
  }

  const { data: job } = await admin
    .from("delivery_jobs")
    .insert({
      delivery_id: delivery.id,
      job_type: "create_claim",
      status: "pending",
      next_run_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  await logDeliveryEvent({
    deliveryId: delivery.id,
    eventType: "delivery_queued",
    statusTo: "queued",
    payload: { providerPrice: estimate.price },
  });

  if (job) {
    await executeSingleJob(job.id).catch(() => {});
  }

  const { data: freshDelivery } = await admin
    .from("deliveries")
    .select("*")
    .eq("id", delivery.id)
    .single();

  return { delivery: freshDelivery || delivery, alreadyExisted: false };
}

export async function executeSingleJob(jobId: string) {
  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: job } = await admin
    .from("delivery_jobs")
    .update({ status: "processing", locked_at: nowIso, updated_at: nowIso })
    .eq("id", jobId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (!job) return;

  const { data: delivery } = await admin
    .from("deliveries")
    .select("*")
    .eq("id", job.delivery_id)
    .maybeSingle();

  if (!delivery) {
    await admin
      .from("delivery_jobs")
      .update({ status: "failed", last_error: "Delivery not found" })
      .eq("id", job.id);
    return;
  }

  const typedDelivery = delivery as DeliveryRow;

  try {
    const creds = await getBusinessYandexCredentials(typedDelivery.business_id);

    if (job.job_type === "create_claim") {
      if (typedDelivery.external_claim_id) {
        await syncOneDelivery(typedDelivery);
      } else {
        const [orderRes, bizRes] = await Promise.all([
          admin.from("orders").select("*").eq("id", typedDelivery.order_id).single(),
          admin
            .from("businesses")
            .select(
              "name, phone, delivery_pickup_entrance, delivery_pickup_phone, delivery_pickup_comment"
            )
            .eq("id", typedDelivery.business_id)
            .single(),
        ]);

        const order = orderRes.data;
        const biz = bizRes.data;
        if (!order || !biz) throw new Error("Данные заказа или компании не найдены.");
        if (
          typedDelivery.pickup_lat == null ||
          typedDelivery.pickup_lng == null ||
          typedDelivery.dropoff_lat == null ||
          typedDelivery.dropoff_lng == null
        ) {
          throw new Error("Отсутствуют координаты маршрута.");
        }

        const claim = await createYandexClaim(creds, {
          idempotencyKey: typedDelivery.idempotency_key,
          orderCode: order.order_code,
          pickup: {
            lat: typedDelivery.pickup_lat,
            lng: typedDelivery.pickup_lng,
            address: typedDelivery.pickup_address,
            entrance: biz.delivery_pickup_entrance || "",
            comment: biz.delivery_pickup_comment || "",
            contactName: biz.name,
            contactPhone: biz.delivery_pickup_phone || biz.phone || "",
          },
          dropoff: {
            lat: typedDelivery.dropoff_lat,
            lng: typedDelivery.dropoff_lng,
            address: typedDelivery.dropoff_address,
            comment: order.comment || "",
            contactName: order.client_name,
            contactPhone: order.client_phone,
          },
          items: Array.isArray(order.items) ? order.items : [],
        });

        const mapped = mapYandexStatusToLocal(claim.status);
        await admin
          .from("deliveries")
          .update({
            external_claim_id: claim.id,
            yandex_version: claim.version || 1,
            status: mapped,
            tracking_url: extractTrackingUrl(claim),
            last_error: "",
            updated_at: new Date().toISOString(),
          })
          .eq("id", typedDelivery.id);

        await logDeliveryEvent({
          deliveryId: typedDelivery.id,
          eventType: "yandex_claim_created",
          statusFrom: typedDelivery.status,
          statusTo: mapped,
          payload: { claimId: claim.id, yandexStatus: claim.status },
        });
      }
    }

    await admin
      .from("delivery_jobs")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", job.id);
  } catch (err) {
    const isYandexErr = err instanceof YandexApiError;
    const retryable = isYandexErr ? err.retryable : false;
    const message = err instanceof Error ? err.message : "Неизвестная ошибка доставки";

    const nextAttempts = Number(job.attempts || 0) + 1;
    const maxAttempts = Number(job.max_attempts || 5);

    if (retryable && nextAttempts < maxAttempts) {
      const delaySec =
        BACKOFF_SECONDS[Math.min(nextAttempts - 1, BACKOFF_SECONDS.length - 1)];
      const nextRun = new Date(Date.now() + delaySec * 1000).toISOString();

      await admin
        .from("delivery_jobs")
        .update({
          status: "pending",
          attempts: nextAttempts,
          next_run_at: nextRun,
          last_error: message,
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    } else {
      await admin
        .from("delivery_jobs")
        .update({
          status: "dead",
          attempts: nextAttempts,
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await admin
        .from("deliveries")
        .update({
          status: "failed",
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", typedDelivery.id);

      await notifyBusinessRecipients(typedDelivery.business_id, typedDelivery.order_id, "failed", {
        error: message,
      });
    }
  }
}

async function notifyBusinessRecipients(
  businessId: string,
  orderId: string,
  status: DeliveryStatus,
  extra: { courierName?: string; trackingUrl?: string; providerPrice?: number; error?: string } = {}
) {
  const admin = getSupabaseAdmin();
  const [bizRes, ordRes, chanRes] = await Promise.all([
    admin.from("businesses").select("name").eq("id", businessId).maybeSingle(),
    admin.from("orders").select("order_code").eq("id", orderId).maybeSingle(),
    admin
      .from("business_channels")
      .select("owner_telegram_chat_id, telegram_order_recipients")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const chatIds = resolveOrderRecipientChatIds(
    chanRes.data?.owner_telegram_chat_id,
    chanRes.data?.telegram_order_recipients
  );
  if (chatIds.length === 0 || !ordRes.data) return;

  await notifyDeliveryStatusUpdate({
    chatIds,
    businessName: bizRes.data?.name || "TIYIN Space",
    orderCode: ordRes.data.order_code,
    status,
    courierName: extra.courierName,
    trackingUrl: extra.trackingUrl,
    finalPrice: extra.providerPrice,
    error: extra.error,
  });
}

export async function syncOneDelivery(delivery: DeliveryRow) {
  if (!delivery.external_claim_id) return;
  const admin = getSupabaseAdmin();
  const creds = await getBusinessYandexCredentials(delivery.business_id);

  const claim = await getYandexClaimInfo(creds, delivery.external_claim_id);
  const nextStatus = mapYandexStatusToLocal(claim.status);
  const trackingUrl = extractTrackingUrl(claim) || delivery.tracking_url || "";
  const courierName = claim.performer_info?.courier_name || delivery.courier_name || "";
  const yandexVersion = claim.version || delivery.yandex_version || 1;

  if (nextStatus === "ready_for_approval") {
    const offerRaw = Math.ceil(Number(claim.pricing?.offer?.price || 0));
    if (
      delivery.provider_price > 0 &&
      offerRaw > Math.round(delivery.provider_price * MAX_AUTO_PRICE_SURGE_RATIO)
    ) {
      await cancelYandexClaim(creds, delivery.external_claim_id, yandexVersion, "free").catch(
        () => {}
      );
      await admin
        .from("deliveries")
        .update({
          status: "failed",
          last_error: `Тариф Яндекса вырос до ${offerRaw} ₸. Повторите вызов вручную.`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.id);
      return;
    }

    const accepted = await acceptYandexClaim(creds, delivery.external_claim_id, yandexVersion);
    const afterAcceptStatus = mapYandexStatusToLocal(accepted.status);
    await admin
      .from("deliveries")
      .update({
        status: afterAcceptStatus,
        yandex_version: accepted.version || yandexVersion,
        provider_price: offerRaw > 0 ? offerRaw : delivery.provider_price,
        tracking_url: trackingUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    return;
  }

  const statusChanged = nextStatus !== delivery.status;
  const finalProviderRaw = Math.ceil(Number(claim.pricing?.final_price || 0));

  await admin
    .from("deliveries")
    .update({
      status: nextStatus,
      yandex_version: yandexVersion,
      provider_price: finalProviderRaw > 0 ? finalProviderRaw : delivery.provider_price,
      courier_name: courierName,
      tracking_url: trackingUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id);

  if (nextStatus === "delivered") {
    await admin.from("orders").update({ status: "done" }).eq("id", delivery.order_id);
  }

  if (statusChanged) {
    await logDeliveryEvent({
      deliveryId: delivery.id,
      eventType: "status_synced",
      statusFrom: delivery.status,
      statusTo: nextStatus,
      payload: { yandexStatus: claim.status, courierName, trackingUrl },
    });

    if (["courier_found", "picked_up", "delivered", "cancelled", "failed"].includes(nextStatus)) {
      await notifyBusinessRecipients(delivery.business_id, delivery.order_id, nextStatus, {
        courierName,
        trackingUrl,
        providerPrice: finalProviderRaw > 0 ? finalProviderRaw : delivery.provider_price,
      });
    }
  }
}

export async function runDeliveryWorkerTick() {
  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const staleThreshold = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  await admin
    .from("delivery_jobs")
    .update({ status: "pending", locked_at: null })
    .eq("status", "processing")
    .lt("locked_at", staleThreshold);

  const { data: jobs } = await admin
    .from("delivery_jobs")
    .select("id")
    .eq("status", "pending")
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(15);

  let jobsProcessed = 0;
  for (const job of jobs || []) {
    await executeSingleJob(job.id);
    jobsProcessed++;
  }

  const { data: activeDeliveries } = await admin
    .from("deliveries")
    .select("*")
    .in("status", [
      "estimating",
      "request_sent",
      "ready_for_approval",
      "searching_courier",
      "courier_found",
      "picked_up",
    ])
    .neq("external_claim_id", "")
    .order("updated_at", { ascending: true })
    .limit(30);

  let synced = 0;
  for (const d of (activeDeliveries as DeliveryRow[]) || []) {
    try {
      await syncOneDelivery(d);
      synced++;
    } catch {
      // keep running for other businesses
    }
  }

  return { jobsProcessed, synced };
}

export async function cancelDeliveryByBusiness(deliveryId: string, businessId: string) {
  const admin = getSupabaseAdmin();
  const { data: delivery } = await admin
    .from("deliveries")
    .select("*")
    .eq("id", deliveryId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!delivery) throw new Error("Доставка не найдена.");
  if (["delivered", "cancelled", "failed"].includes(delivery.status)) return delivery;

  if (delivery.external_claim_id) {
    const creds = await getBusinessYandexCredentials(businessId);
    await cancelYandexClaim(creds, delivery.external_claim_id, delivery.yandex_version || 1, "free");
  }

  const { data: updated } = await admin
    .from("deliveries")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id)
    .select("*")
    .single();

  await logDeliveryEvent({
    deliveryId: delivery.id,
    eventType: "cancelled_by_business",
    statusFrom: delivery.status,
    statusTo: "cancelled",
  });

  return updated;
}
