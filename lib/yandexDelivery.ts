import { DeliveryStatus } from "@/lib/types";

const PROD_BASE_URL = "https://b2b.taxi.yandex.net";
const TEST_BASE_URL = "https://b2b.taxi.tst.yandex.net";

export interface YandexCredentials {
  apiToken: string;
  testMode?: boolean;
}

export class YandexApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, status: number, code = "", retryable = false) {
    super(message);
    this.name = "YandexApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function formatKzPhoneE164(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("7")) return `+7${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500 || status === 0;
}

async function yandexFetch<T>(
  creds: YandexCredentials,
  path: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {}
): Promise<T> {
  const token = String(creds.apiToken || "").trim();
  if (!token) {
    throw new YandexApiError(
      "API-токен Яндекс Доставки не указан в настройках кабинета.",
      400,
      "missing_token",
      false
    );
  }
  const baseUrl = creds.testMode ? TEST_BASE_URL : PROD_BASE_URL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept-Language": "ru",
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const code = String(data?.code || res.status);
      const msg =
        res.status === 401 || res.status === 403
          ? "Яндекс Доставка отклонила ваш API-токен. Проверьте токен и режим (Тест/Боевой) в Настройках → Доставка."
          : String(data?.message || data?.error || "").trim() ||
            `Ошибка Яндекс Доставки (HTTP ${res.status})`;
      throw new YandexApiError(msg, res.status, code, isRetryableHttpStatus(res.status));
    }

    return data as T;
  } catch (err) {
    if (err instanceof YandexApiError) throw err;
    const isAbort = err instanceof Error && err.name === "AbortError";
    throw new YandexApiError(
      isAbort
        ? "Таймаут ответа Яндекс Доставки"
        : "Сетевая ошибка при обращении к Яндекс Доставке",
      0,
      isAbort ? "timeout" : "network_error",
      true
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function geocodeAddressKz(
  address: string,
  city = "Алматы"
): Promise<{ lat: number; lng: number; fullname: string } | null> {
  const cleanAddr = address.trim();
  if (!cleanAddr) return null;

  const fullQuery = cleanAddr.toLowerCase().includes(city.toLowerCase())
    ? `Казахстан, ${cleanAddr}`
    : `Казахстан, ${city}, ${cleanAddr}`;

  const yandexGeoKey = (process.env.YANDEX_GEOCODER_API_KEY || "").trim();

  if (yandexGeoKey) {
    try {
      const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(
        yandexGeoKey
      )}&geocode=${encodeURIComponent(fullQuery)}&format=json&results=1&lang=ru_RU`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const geoObj =
          json?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
        const pos = String(geoObj?.Point?.pos || "").trim();
        const [lngStr, latStr] = pos.split(" ");
        const lng = Number(lngStr);
        const lat = Number(latStr);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const fullname =
            geoObj?.metaDataProperty?.GeocoderMetaData?.text || fullQuery;
          return { lat, lng, fullname };
        }
      }
    } catch {
      // fallback below
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kz&q=${encodeURIComponent(
      fullQuery
    )}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TIYIN-Space-Delivery/1.0 (https://tiyin.kz)" },
      cache: "no-store",
    });
    if (res.ok) {
      const arr = await res.json();
      const first = Array.isArray(arr) ? arr[0] : null;
      if (first?.lat && first?.lon) {
        const lat = Number(first.lat);
        const lng = Number(first.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng, fullname: fullQuery };
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export interface YandexEstimateResult {
  price: number;
  currency: string;
  etaMinutes?: number;
}

export async function estimateYandexDelivery(
  creds: YandexCredentials,
  params: {
    pickup: { lat: number; lng: number; address: string };
    dropoff: { lat: number; lng: number; address: string };
  }
): Promise<YandexEstimateResult> {
  const data = await yandexFetch<{
    price?: string | number;
    currency_rules?: { code?: string };
    eta?: number;
  }>(creds, "/b2b/cargo/integration/v2/check-price", {
    method: "POST",
    body: {
      items: [
        {
          quantity: 1,
          size: { height: 0.25, length: 0.35, width: 0.35 },
          weight: 2,
        },
      ],
      route_points: [
        {
          coordinates: [params.pickup.lng, params.pickup.lat],
          fullname: params.pickup.address,
        },
        {
          coordinates: [params.dropoff.lng, params.dropoff.lat],
          fullname: params.dropoff.address,
        },
      ],
      requirements: {
        taxi_class: "courier",
      },
    },
  });

  const priceNum = Math.ceil(Number(data?.price || 0));
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    throw new YandexApiError(
      "Яндекс не вернул стоимость поездки по этому адресу.",
      400,
      "empty_price",
      false
    );
  }

  return {
    price: priceNum,
    currency: data?.currency_rules?.code || "KZT",
    etaMinutes: typeof data?.eta === "number" ? data.eta : undefined,
  };
}

export interface YandexClaimResponse {
  id: string;
  status: string;
  version: number;
  pricing?: {
    offer?: { price?: string };
    final_price?: string;
    currency?: string;
  };
  performer_info?: {
    courier_name?: string;
    legal_name?: string;
    car_model?: string;
    car_number?: string;
  };
  route_points?: Array<{
    id?: number;
    type?: string;
    sharing_link?: string;
  }>;
}

export async function createYandexClaim(
  creds: YandexCredentials,
  params: {
    idempotencyKey: string;
    orderCode: string;
    pickup: {
      lat: number;
      lng: number;
      address: string;
      entrance?: string;
      comment?: string;
      contactName: string;
      contactPhone: string;
    };
    dropoff: {
      lat: number;
      lng: number;
      address: string;
      comment?: string;
      contactName: string;
      contactPhone: string;
    };
    items: { name: string; price: number; quantity: number }[];
  }
): Promise<YandexClaimResponse> {
  const sourceItems =
    params.items.length > 0
      ? params.items
      : [{ name: `Заказ ${params.orderCode}`, price: 1000, quantity: 1 }];

  const cargoItems = sourceItems.map((item, idx) => ({
    extra_id: `${params.orderCode}-${idx + 1}`,
    pickup_point: 1,
    dropoff_point: 2,
    title: String(item.name || "Товар").slice(0, 120),
    quantity: Math.max(1, Number(item.quantity) || 1),
    cost_value: String(Math.max(1, Number(item.price) || 1)),
    cost_currency: "KZT",
    weight: 0.5,
    size: { height: 0.15, length: 0.25, width: 0.25 },
  }));

  const pickupPhone = formatKzPhoneE164(params.pickup.contactPhone);
  const dropoffPhone = formatKzPhoneE164(params.dropoff.contactPhone);

  return yandexFetch<YandexClaimResponse>(
    creds,
    `/b2b/cargo/integration/v2/claims/create?request_id=${encodeURIComponent(
      params.idempotencyKey
    )}`,
    {
      method: "POST",
      body: {
        items: cargoItems,
        comment: `Заказ ${params.orderCode} (TIYIN Space)`,
        client_requirements: { taxi_class: "courier" },
        emergency_contact: {
          name: params.pickup.contactName.slice(0, 60),
          phone: pickupPhone,
        },
        route_points: [
          {
            point_id: 1,
            visit_order: 1,
            type: "source",
            address: {
              fullname: params.pickup.address,
              coordinates: [params.pickup.lng, params.pickup.lat],
              porch: params.pickup.entrance || undefined,
              comment: params.pickup.comment || `Забрать заказ ${params.orderCode}`,
            },
            contact: {
              name: params.pickup.contactName.slice(0, 60),
              phone: pickupPhone,
            },
            skip_confirmation: true,
          },
          {
            point_id: 2,
            visit_order: 2,
            type: "destination",
            address: {
              fullname: params.dropoff.address,
              coordinates: [params.dropoff.lng, params.dropoff.lat],
              comment: params.dropoff.comment || `Заказ ${params.orderCode}`,
            },
            contact: {
              name: params.dropoff.contactName.slice(0, 60),
              phone: dropoffPhone,
            },
            skip_confirmation: true,
          },
        ],
      },
    }
  );
}

export async function getYandexClaimInfo(
  creds: YandexCredentials,
  claimId: string
): Promise<YandexClaimResponse> {
  return yandexFetch<YandexClaimResponse>(
    creds,
    `/b2b/cargo/integration/v2/claims/info?claim_id=${encodeURIComponent(claimId)}`,
    { method: "POST", body: {} }
  );
}

export async function acceptYandexClaim(
  creds: YandexCredentials,
  claimId: string,
  version: number
): Promise<{ id: string; status: string; version: number }> {
  return yandexFetch(
    creds,
    `/b2b/cargo/integration/v2/claims/accept?claim_id=${encodeURIComponent(claimId)}`,
    { method: "POST", body: { version } }
  );
}

export async function cancelYandexClaim(
  creds: YandexCredentials,
  claimId: string,
  version: number,
  cancelState: "free" | "paid" = "free"
): Promise<{ id: string; status: string; version: number }> {
  return yandexFetch(
    creds,
    `/b2b/cargo/integration/v2/claims/cancel?claim_id=${encodeURIComponent(claimId)}`,
    { method: "POST", body: { version, cancel_state: cancelState } }
  );
}

export function extractTrackingUrl(claim: YandexClaimResponse): string {
  const dest = claim.route_points?.find((p) => p.type === "destination");
  return dest?.sharing_link || claim.route_points?.[1]?.sharing_link || "";
}

export function mapYandexStatusToLocal(yandexStatus: string): DeliveryStatus {
  switch (yandexStatus) {
    case "new":
    case "estimating":
      return "estimating";
    case "ready_for_approval":
      return "ready_for_approval";
    case "accepted":
    case "performer_lookup":
    case "performer_draft":
      return "searching_courier";
    case "performer_found":
    case "pickup_arrived":
      return "courier_found";
    case "ready_for_pickup_confirmation":
    case "pickuped":
    case "delivery_arrived":
    case "ready_for_delivery_confirmation":
      return "picked_up";
    case "delivered":
    case "delivered_finish":
      return "delivered";
    case "cancelled":
    case "cancelled_with_payment":
    case "cancelled_by_taxi":
    case "cancelled_with_items_on_hands":
    case "returned":
    case "returned_finish":
      return "cancelled";
    case "estimating_failed":
    case "failed":
    case "performer_not_found":
      return "failed";
    default:
      return "request_sent";
  }
}
