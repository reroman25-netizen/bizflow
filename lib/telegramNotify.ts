function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const CHANNEL_LABELS: Record<string, string> = {
  web: "Витрина TIYIN",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  telegram: "Telegram",
};

function getAppBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "https://tiyin.kz").trim();
  return raw.replace(/\/+$/, "");
}

function buildWebAppButtonMarkup(text: string, path: string): Record<string, unknown> | undefined {
  const baseUrl = getAppBaseUrl();
  // Telegram требует строго HTTPS для кнопок Mini App (web_app)
  if (!baseUrl.startsWith("https://")) {
    return undefined;
  }
  return {
    inline_keyboard: [
      [
        {
          text,
          web_app: { url: `${baseUrl}${path}` },
        },
      ],
    ],
  };
}

export async function sendTelegramMessage(
  chatId: string,
  htmlText: string,
  replyMarkup?: Record<string, unknown>
): Promise<boolean> {
  const token = process.env.TELEGRAM_NOTIFY_BOT_TOKEN;
  const cleanChatId = (chatId || "").trim();
  if (!token || !cleanChatId) return false;

  try {
    const payload: Record<string, unknown> = {
      chat_id: cleanChatId,
      text: htmlText,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function notifyOwnerNewOrder(params: {
  chatId: string;
  businessName: string;
  orderCode: string;
  source: string;
  clientName: string;
  clientPhone: string;
  paymentMethod?: string;
  deliveryMethod?: string;
  comment?: string;
  items: { name: string; quantity: number; price: number }[];
  totalPrice: number;
}) {
  if (!params.chatId) return;

  const sourceName = CHANNEL_LABELS[params.source] || params.source;
  const itemsLines = params.items
    .map((i) => `• ${escapeHtml(i.name)} ×${i.quantity} — ${i.price * i.quantity} ₸`)
    .join("\n");

  const text = [
    `🛍 <b>Новый заказ ${escapeHtml(params.orderCode)}</b> (${escapeHtml(sourceName)})`,
    `Компания: <b>${escapeHtml(params.businessName)}</b>`,
    ``,
    `👤 Клиент: ${escapeHtml(params.clientName)}`,
    `📞 Телефон: ${escapeHtml(params.clientPhone)}`,
    params.paymentMethod ? `💳 Оплата: ${escapeHtml(params.paymentMethod)}` : "",
    params.deliveryMethod ? `🚚 Получение: ${escapeHtml(params.deliveryMethod)}` : "",
    params.comment ? `📍 Комментарий / адрес: ${escapeHtml(params.comment)}` : "",
    ``,
    itemsLines,
    ``,
    `💰 <b>Итого: ${new Intl.NumberFormat("ru-RU").format(params.totalPrice)} ₸</b>`,
  ]
    .filter(Boolean)
    .join("\n");

  const markup = buildWebAppButtonMarkup(
    "Открыть в кабинете",
    "/dashboard?tab=orders"
  );

  await sendTelegramMessage(params.chatId, text, markup);
}

export async function notifyOwnerHandoff(params: {
  chatId: string;
  businessName: string;
  channel: string;
  clientName: string;
  clientPhone?: string;
  reason: string;
  lastMessage: string;
}) {
  if (!params.chatId) return;

  const channelName = CHANNEL_LABELS[params.channel] || params.channel;
  const text = [
    `🔔 <b>TIYIN AI зовет менеджера</b> (${escapeHtml(channelName)})`,
    `Компания: <b>${escapeHtml(params.businessName)}</b>`,
    ``,
    `👤 Клиент: ${escapeHtml(params.clientName)}${params.clientPhone ? ` (${escapeHtml(params.clientPhone)})` : ""}`,
    `⚠️ Причина: ${escapeHtml(params.reason)}`,
    `💬 Последнее сообщение: «${escapeHtml(params.lastMessage)}»`,
    ``,
    `<i>ИИ-агент поставил этот чат на паузу. Откройте раздел TIYIN AI в кабинете.</i>`,
  ].join("\n");

  const markup = buildWebAppButtonMarkup(
    "Открыть диалог в кабинете",
    "/dashboard?tab=ai"
  );

  await sendTelegramMessage(params.chatId, text, markup);
}

export async function notifySuperAdminSubscription(params: {
  businessName: string;
  businessSlug: string;
  channels: string[];
  monthlyPrice: number;
  estimatedDays: number;
  contactPhone: string;
  comment?: string;
}) {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID || "";
  if (!adminChatId) return;

  const text = [
    `🚀 <b>Новая заявка на подписку TIYIN AI!</b>`,
    `Бизнес: <b>${escapeHtml(params.businessName)}</b> (/${escapeHtml(params.businessSlug)})`,
    `Каналы: ${escapeHtml(params.channels.join(", "))}`,
    `Тариф: <b>${new Intl.NumberFormat("ru-RU").format(params.monthlyPrice)} ₸/мес</b> (срок запуска: ${params.estimatedDays} дн.)`,
    `Контакт: ${escapeHtml(params.contactPhone || "не указан")}`,
    params.comment ? `Комментарий: ${escapeHtml(params.comment)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const markup = buildWebAppButtonMarkup("Открыть админку", "/admin");

  await sendTelegramMessage(adminChatId, text, markup);
}
export async function notifyOwnerBillingReminder(params: {
  chatId: string;
  businessName: string;
  daysLeft: number;
  activeUntilFormatted: string;
  monthlyPrice: number;
  yearlyPrice: number;
}) {
  if (!params.chatId) return false;

  const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
  let headline = "";
  if (params.daysLeft > 1) {
    headline = `⏳ <b>Через ${params.daysLeft} дн. заканчивается бесплатный период</b>`;
  } else if (params.daysLeft === 1) {
    headline = `⏳ <b>Завтра заканчивается срок действия тарифа</b>`;
  } else if (params.daysLeft === 0) {
    headline = `🔔 <b>Сегодня заканчивается срок действия тарифа</b>`;
  } else {
    headline = `⚠️ <b>Срок действия тарифа истек (${Math.abs(params.daysLeft)} дн. назад)</b>`;
  }

  const text = [
    headline,
    `Компания: <b>${escapeHtml(params.businessName)}</b>`,
    `Дата окончания: <b>${escapeHtml(params.activeUntilFormatted)}</b>`,
    ``,
    `Мы по-прежнему берем <b>0% комиссии с ваших продаж</b>.`,
    `Выберите удобный вариант продления:`,
    `• Помесячно: <b>${fmt(params.monthlyPrice)} ₸ / мес</b>`,
    `• Выгодно на год (2 мес. в подарок): <b>${fmt(params.yearlyPrice)} ₸ / год</b>`,
    ``,
    `Для продления напишите нам в Telegram: @tiyinkz`,
  ].join("\n");

  const markup = buildWebAppButtonMarkup("Открыть кабинет", "/dashboard?tab=settings");
  return sendTelegramMessage(params.chatId, text, markup);
}

export async function notifySuperAdminBillingDigest(params: {
  items: {
    name: string;
    slug: string;
    phone: string;
    daysUsed: number;
    daysLeft: number;
    activeUntilFormatted: string;
    planTier: string;
  }[];
}) {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID || "";
  if (!adminChatId || params.items.length === 0) return false;

  const lines = params.items.map((item, idx) => {
    const statusText =
      item.daysLeft < 0
        ? `просрочено ${Math.abs(item.daysLeft)} дн.`
        : item.daysLeft === 0
        ? `истекает СЕГОДНЯ`
        : `осталось ${item.daysLeft} дн.`;
    const planLabel = item.planTier === "ai_autopilot" ? "TIYIN AI" : "База";
    return `${idx + 1}. <b>${escapeHtml(item.name)}</b> (/${escapeHtml(item.slug)}) — ${planLabel}, ${statusText} (до ${escapeHtml(item.activeUntilFormatted)}), в системе ${item.daysUsed} дн.${item.phone ? ` • ${escapeHtml(item.phone)}` : ""}`;
  });

  const text = [
    `💳 <b>Сводка по срокам и оплатам TIYIN Space (${params.items.length})</b>`,
    ``,
    ...lines,
    ``,
    `<i>Откройте вкладку «Биллинг» в админке, чтобы отметить оплату в 1 клик.</i>`,
  ].join("\n");

  const markup = buildWebAppButtonMarkup("Открыть админку", "/admin");
  return sendTelegramMessage(adminChatId, text, markup);
}
