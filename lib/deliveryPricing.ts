import { formatKZT } from "@/lib/format";

export interface DeliveryConfigInput {
  delivery_enabled?: boolean | null;
  delivery_pricing_mode?: string | null;
  delivery_fixed_price?: number | null;
  delivery_free_from?: number | null;
  delivery_min_order?: number | null;
  delivery_show_included_badge?: boolean | null;
}

export interface ClientDeliveryEvaluation {
  enabled: boolean;
  mode: "fixed" | "included";
  fee: number;
  isFree: boolean;
  isIncluded: boolean;
  showIncludedBadge: boolean;
  minOrderAmount: number | null;
  minOrderNotMet: boolean;
  amountToMinOrder: number;
  freeFromAmount: number | null;
  amountToFreeDelivery: number;
  summaryLine: string;
  shortBadge: string;
}

export function evaluateClientDelivery(
  business: DeliveryConfigInput | null | undefined,
  cartSubtotal: number
): ClientDeliveryEvaluation {
  const enabled = Boolean(business?.delivery_enabled);
  const mode = business?.delivery_pricing_mode === "included" ? "included" : "fixed";
  const fixedPrice = Math.max(0, Number(business?.delivery_fixed_price || 0));
  const freeFromRaw = Number(business?.delivery_free_from || 0);
  const freeFromAmount = freeFromRaw > 0 ? freeFromRaw : null;
  const minOrderRaw = Number(business?.delivery_min_order || 0);
  const minOrderAmount = minOrderRaw > 0 ? minOrderRaw : null;
  const showIncludedBadge = business?.delivery_show_included_badge !== false;

  const subtotal = Math.max(0, Number(cartSubtotal || 0));
  const minOrderNotMet = Boolean(minOrderAmount && subtotal < minOrderAmount);
  const amountToMinOrder = minOrderNotMet && minOrderAmount ? minOrderAmount - subtotal : 0;

  if (!enabled) {
    return {
      enabled: false,
      mode: "fixed",
      fee: 0,
      isFree: false,
      isIncluded: false,
      showIncludedBadge: false,
      minOrderAmount: null,
      minOrderNotMet: false,
      amountToMinOrder: 0,
      freeFromAmount: null,
      amountToFreeDelivery: 0,
      summaryLine: "Самовывоз или доставка курьером (по согласованию)",
      shortBadge: "",
    };
  }

  if (mode === "included") {
    const summaryParts: string[] = [];
    if (showIncludedBadge) {
      summaryParts.push("Доставка включена в стоимость");
    } else {
      summaryParts.push("Доставка курьером");
    }
    if (minOrderAmount) {
      summaryParts.push(`заказ от ${formatKZT(minOrderAmount)}`);
    }

    return {
      enabled: true,
      mode: "included",
      fee: 0,
      isFree: true,
      isIncluded: true,
      showIncludedBadge,
      minOrderAmount,
      minOrderNotMet,
      amountToMinOrder,
      freeFromAmount: null,
      amountToFreeDelivery: 0,
      summaryLine: summaryParts.join(" · "),
      shortBadge: showIncludedBadge
        ? minOrderAmount
          ? `Доставка включена (от ${formatKZT(minOrderAmount)})`
          : "Доставка включена"
        : "",
    };
  }

  const qualifiesForFree = Boolean(freeFromAmount && subtotal >= freeFromAmount);
  const fee = qualifiesForFree ? 0 : fixedPrice;
  const amountToFreeDelivery =
    freeFromAmount && fixedPrice > 0 && subtotal < freeFromAmount
      ? freeFromAmount - subtotal
      : 0;

  const summaryParts: string[] = [];
  if (fixedPrice > 0) {
    summaryParts.push(`Доставка ${formatKZT(fixedPrice)}`);
    if (freeFromAmount) {
      summaryParts.push(`бесплатно от ${formatKZT(freeFromAmount)}`);
    }
  } else {
    summaryParts.push("Бесплатная доставка");
  }
  if (minOrderAmount) {
    summaryParts.push(`мин. заказ ${formatKZT(minOrderAmount)}`);
  }

  const shortBadge =
    fixedPrice > 0
      ? freeFromAmount
        ? `Доставка ${formatKZT(fixedPrice)} · бесплатно от ${formatKZT(freeFromAmount)}`
        : `Доставка ${formatKZT(fixedPrice)}`
      : "Бесплатная доставка";

  return {
    enabled: true,
    mode: "fixed",
    fee,
    isFree: fee === 0,
    isIncluded: false,
    showIncludedBadge: false,
    minOrderAmount,
    minOrderNotMet,
    amountToMinOrder,
    freeFromAmount,
    amountToFreeDelivery,
    summaryLine: summaryParts.join(" · "),
    shortBadge,
  };
}
