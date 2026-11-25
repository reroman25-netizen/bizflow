"use client";

import { useState } from "react";
import {
  Truck,
  Loader2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { DeliveryRecord, DeliveryStatus, Order } from "@/lib/types";
import { formatKZT } from "@/lib/format";

const DELIVERY_STATUS_UI: Record<
  DeliveryStatus,
  { label: string; className: string }
> = {
  queued: { label: "В очереди", className: "bg-slate-100 text-slate-700" },
  estimating: { label: "Расчёт Яндекса...", className: "bg-amber-50 text-amber-700" },
  request_sent: { label: "Запрос отправлен", className: "bg-blue-50 text-blue-700" },
  ready_for_approval: { label: "Подтверждаем...", className: "bg-blue-50 text-blue-700" },
  searching_courier: { label: "Ищем курьера...", className: "bg-amber-50 text-amber-800" },
  courier_found: { label: "Курьер едет к вам", className: "bg-indigo-50 text-indigo-700" },
  picked_up: { label: "Курьер в пути к клиенту", className: "bg-sky-50 text-sky-700" },
  delivered: { label: "Доставлен", className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Доставка отменена", className: "bg-slate-100 text-slate-500" },
  failed: { label: "Ошибка доставки", className: "bg-red-50 text-red-700" },
  needs_attention: { label: "Требует внимания", className: "bg-red-50 text-red-700" },
};

interface OrderDeliveryControlProps {
  order: Order;
  delivery?: DeliveryRecord | null;
  accessToken: string;
  onDeliveryUpdated: (delivery: DeliveryRecord) => void;
}

export function OrderDeliveryControl({
  order,
  delivery,
  accessToken,
  onDeliveryUpdated,
}: OrderDeliveryControlProps) {
  const [quoting, setQuoting] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<{
    providerPrice: number;
    dropoffAddress: string;
  } | null>(null);

  if (order.delivery_method !== "Доставка курьером") return null;

  const isActive = delivery && !["cancelled", "failed"].includes(delivery.status);

  const handleQuote = async () => {
    setQuoting(true);
    setError("");
    try {
      const res = await fetch("/api/delivery/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ orderId: order.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Не удалось рассчитать доставку.");
        return;
      }
      setQuote(json.quote);
    } catch {
      setError("Ошибка сети при расчёте доставки.");
    } finally {
      setQuoting(false);
    }
  };

  const handleDispatch = async () => {
    if (!quote) return;
    setDispatching(true);
    setError("");
    try {
      const res = await fetch("/api/delivery/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          confirmedPrice: quote.providerPrice,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Не удалось вызвать курьера.");
        return;
      }
      setQuote(null);
      if (json.delivery) onDeliveryUpdated(json.delivery);
    } catch {
      setError("Ошибка сети при вызове курьера.");
    } finally {
      setDispatching(false);
    }
  };

  const handleCancel = async () => {
    if (!delivery) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/delivery/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ deliveryId: delivery.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Не удалось отменить доставку.");
        return;
      }
      if (json.delivery) onDeliveryUpdated(json.delivery);
    } catch {
      setError("Ошибка сети при отмене.");
    } finally {
      setCancelling(false);
    }
  };

  const isUnconfirmedKaspi =
    order.payment_provider === "kaspi" && order.payment_status !== "paid";

  return (
    <div className="pt-3 border-t border-slate-100 space-y-2">
      {isActive && delivery ? (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 rounded-2xl p-3 border border-slate-200/70">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-neutral-700" />
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                  DELIVERY_STATUS_UI[delivery.status]?.className ||
                  "bg-slate-100 text-slate-700"
                }`}
              >
                {DELIVERY_STATUS_UI[delivery.status]?.label || delivery.status}
              </span>
              {delivery.provider_price > 0 && (
                <span className="text-xs font-bold text-neutral-900">
                  {formatKZT(delivery.provider_price)}
                </span>
              )}
            </div>
            {delivery.courier_name && (
              <div className="text-xs text-slate-600">
                Курьер: <strong>{delivery.courier_name}</strong>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {delivery.tracking_url && (
              <a
                href={delivery.tracking_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-neutral-800 transition"
              >
                <span>На карте</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {[
              "queued",
              "estimating",
              "request_sent",
              "searching_courier",
              "courier_found",
            ].includes(delivery.status) && (
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancel}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{cancelling ? "..." : "Отменить"}</span>
              </button>
            )}
          </div>
        </div>
      ) : quote ? (
        <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-3.5 space-y-2.5">
          <div className="text-xs text-slate-700">
            Тариф Яндекс Доставки:{" "}
            <strong className="text-neutral-950 text-sm">
              {formatKZT(quote.providerPrice)}
            </strong>{" "}
            <span className="text-[11px] text-slate-500">
              (списывается с вашего счёта в Яндекс Бизнес)
            </span>
          </div>

          {isUnconfirmedKaspi && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-900 bg-amber-100/80 rounded-xl px-2.5 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Оплата по чеку Kaspi ещё не подтверждена — проверьте поступление перед отправкой.
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={dispatching}
              onClick={handleDispatch}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold transition disabled:opacity-50"
            >
              {dispatching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>
                {dispatching
                  ? "Вызываем..."
                  : `Подтвердить вызов за ${formatKZT(quote.providerPrice)}`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setQuote(null)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {delivery?.last_error && (
            <div className="text-[11px] text-red-600">{delivery.last_error}</div>
          )}
          <button
            type="button"
            disabled={quoting}
            onClick={handleQuote}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
          >
            {quoting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Truck className="w-3.5 h-3.5" />
            )}
            <span>{quoting ? "Считаем цену..." : "Вызвать курьера Яндекс"}</span>
          </button>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
