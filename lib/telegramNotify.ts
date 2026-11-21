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

export async function sendTelegramMessage(chatId: string, htmlText: string): Promise<boolean> {
  const token = process.env.TELEGRAM_NOTIFY_BOT_TOKEN;
  const cleanChatId = (chatId || "").trim();
  if (!token || !cleanChatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: htmlText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
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

  await sendTelegramMessage(params.chatId, text);
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

  await sendTelegramMessage(params.chatId, text);
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

  await sendTelegramMessage(adminChatId, text);
}
