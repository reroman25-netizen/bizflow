import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  dispatchCourierForOrder,
  quoteDeliveryForOrder,
} from "@/lib/deliveryEngine";
import {
  resolveOrderRecipientChatIds,
  sendTelegramMessage,
} from "@/lib/telegramNotify";

export const dynamic = "force-dynamic";

async function answerCallback(callbackQueryId: string, text?: string) {
  const token = process.env.TELEGRAM_NOTIFY_BOT_TOKEN;
  if (!token || !callbackQueryId) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || undefined,
      show_alert: false,
    }),
  }).catch(() => {});
}

async function isAuthorizedRecipient(businessId: string, chatId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data: chan } = await admin
    .from("business_channels")
    .select("owner_telegram_chat_id, telegram_order_recipients")
    .eq("business_id", businessId)
    .maybeSingle();

  const allowed = resolveOrderRecipientChatIds(
    chan?.owner_telegram_chat_id,
    chan?.telegram_order_recipients
  );
  return allowed.includes(String(chatId));
}

export async function POST(req: NextRequest) {
  try {
    const expectedSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
    if (expectedSecret) {
      const headerSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
      if (headerSecret !== expectedSecret) {
        return NextResponse.json({ ok: false }, { status: 403 });
      }
    }

    const update = await req.json();
    const cb = update?.callback_query;
    if (!cb?.data || !cb?.message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(cb.message.chat.id);
    const data = String(cb.data);
    const admin = getSupabaseAdmin();

    if (data.startsWith("deliv_quote:")) {
      const orderId = data.slice("deliv_quote:".length).trim();
      await answerCallback(cb.id, "Считаем тариф Яндекс Доставки...");

      const { data: order } = await admin
        .from("orders")
        .select("id, order_code, business_id, payment_provider, payment_status")
        .eq("id", orderId)
        .maybeSingle();

      if (!order || !(await isAuthorizedRecipient(order.business_id, chatId))) {
        await sendTelegramMessage(chatId, "⛔ Нет прав для управления этим заказом.");
        return NextResponse.json({ ok: true });
      }

      try {
        const quote = await quoteDeliveryForOrder(order.id, order.business_id);
        const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
        const kaspiWarning =
          order.payment_provider === "kaspi" && order.payment_status !== "paid"
            ? `\n⚠️ <b>Внимание:</b> оплата по чеку Kaspi ещё не подтверждена — убедитесь, что деньги поступили.`
            : "";

        await sendTelegramMessage(
          chatId,
          `🚚 <b>Расчёт Яндекс Доставки — заказ ${order.order_code}</b>\n📍 Куда: ${quote.dropoffAddress}\n💰 Тариф Яндекса: <b>${fmt(
            quote.providerPrice
          )} ₸</b> (списывается напрямую с вашего счёта в Яндекс Бизнес)${kaspiWarning}`,
          {
            inline_keyboard: [
              [
                {
                  text: `✅ Вызвать курьера за ${fmt(quote.providerPrice)} ₸`,
                  callback_data: `deliv_confirm:${order.id}:${quote.providerPrice}`,
                },
              ],
              [{ text: "❌ Отмена", callback_data: `deliv_dismiss:${order.id}` }],
            ],
          }
        );
      } catch (err) {
        await sendTelegramMessage(
          chatId,
          `❌ Не удалось рассчитать доставку для ${order.order_code}: ${
            err instanceof Error ? err.message : "Ошибка"
          }`
        );
      }

      return NextResponse.json({ ok: true });
    }

    if (data.startsWith("deliv_confirm:")) {
      const parts = data.split(":");
      const orderId = parts[1] || "";
      const confirmedPrice = Number(parts[2] || 0) || undefined;

      await answerCallback(cb.id, "Отправляем заявку в Яндекс Доставку...");

      const { data: order } = await admin
        .from("orders")
        .select("id, order_code, business_id")
        .eq("id", orderId)
        .maybeSingle();

      if (!order || !(await isAuthorizedRecipient(order.business_id, chatId))) {
        await sendTelegramMessage(chatId, "⛔ Нет прав для управления этим заказом.");
        return NextResponse.json({ ok: true });
      }

      try {
        const res = await dispatchCourierForOrder({
          orderId: order.id,
          businessId: order.business_id,
          confirmedPrice,
        });

        const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
        if (res.alreadyExisted) {
          await sendTelegramMessage(
            chatId,
            `ℹ️ По заказу <b>${order.order_code}</b> курьер уже вызван (дубль заблокирован).`
          );
        } else {
          await sendTelegramMessage(
            chatId,
            `⏳ <b>Заявка принята! Ищем курьера для ${order.order_code}</b>\nОриентировочный тариф Яндекса: <b>${fmt(
              res.delivery.provider_price
            )} ₸</b>.\nКак только курьер будет назначен, пришлю имя и ссылку на карту.`
          );
        }
      } catch (err) {
        await sendTelegramMessage(
          chatId,
          `❌ Не удалось вызвать курьера для ${order.order_code}: ${
            err instanceof Error ? err.message : "Ошибка"
          }`
        );
      }

      return NextResponse.json({ ok: true });
    }

    if (data.startsWith("deliv_dismiss:")) {
      await answerCallback(cb.id, "Отменено");
      return NextResponse.json({ ok: true });
    }

    await answerCallback(cb.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
