import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { notifyOwnerHandoff, notifyOwnerNewOrder } from "@/lib/telegramNotify";
import { ChannelType } from "@/lib/types";

interface AiEngineInput {
  businessId: string;
  channel: ChannelType;
  externalUserId: string;
  clientName?: string;
  clientPhone?: string;
  message: string;
}

interface AiEngineResult {
  reply: string | null;
  conversationId?: string;
  paused?: boolean;
  orderCreated?: { orderCode: string; totalPrice: number } | null;
}

interface ProductRow {
  id: string;
  name: string;
  price: number;
  description: string | null;
  category: string | null;
}

interface MessageRow {
  sender: "client" | "ai" | "owner";
  content: string;
}

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "create_order",
        description:
          "Создать и сохранить подтвержденный заказ клиента в системе, когда клиент назвал выбранные товары, свое имя и номер телефона.",
        parameters: {
          type: "OBJECT",
          properties: {
            client_name: { type: "STRING", description: "Имя клиента" },
            client_phone: { type: "STRING", description: "Телефон клиента" },
            comment: {
              type: "STRING",
              description: "Адрес доставки, время или пожелания клиента",
            },
            items: {
              type: "ARRAY",
              description: "Список заказанных позиций строго из каталога",
              items: {
                type: "OBJECT",
                properties: {
                  product_id: {
                    type: "STRING",
                    description: "Точный ID товара из каталога",
                  },
                  quantity: { type: "NUMBER", description: "Количество (целое число >= 1)" },
                },
                required: ["product_id", "quantity"],
              },
            },
          },
          required: ["client_name", "client_phone", "items"],
        },
      },
      {
        name: "call_manager",
        description:
          "Позвать живого менеджера и поставить ИИ на паузу, если клиент недоволен, просит нестандартную скидку или задает сложный вопрос вне базы знаний.",
        parameters: {
          type: "OBJECT",
          properties: {
            reason: {
              type: "STRING",
              description: "Короткая суть вопроса для владельца бизнеса (1 предложение)",
            },
          },
          required: ["reason"],
        },
      },
    ],
  },
];

export async function runAiEngine(input: AiEngineInput): Promise<AiEngineResult> {
  const admin = getSupabaseAdmin();
  const cleanMsg = input.message.trim();
  if (!cleanMsg) {
    return { reply: "Напишите ваш вопрос, я с радостью помогу!" };
  }

  const [bizRes, aiRes, chanRes, prodRes] = await Promise.all([
    admin.from("businesses").select("*").eq("id", input.businessId).maybeSingle(),
    admin.from("business_ai_configs").select("*").eq("business_id", input.businessId).maybeSingle(),
    admin.from("business_channels").select("*").eq("business_id", input.businessId).maybeSingle(),
    admin
      .from("products")
      .select("id, name, price, description, category")
      .eq("business_id", input.businessId)
      .eq("is_available", true),
  ]);

  const biz = bizRes.data;
  const aiConfig = aiRes.data;
  const channels = chanRes.data;
  const products: ProductRow[] = (prodRes.data as ProductRow[]) || [];

  if (!biz) {
    return { reply: "Компания не найдена." };
  }

  // Находим или создаем диалог в conversations
  let { data: conv } = await admin
    .from("conversations")
    .select("*")
    .eq("business_id", input.businessId)
    .eq("channel", input.channel)
    .eq("external_user_id", input.externalUserId)
    .maybeSingle();

  if (!conv) {
    const { data: created } = await admin
      .from("conversations")
      .insert({
        business_id: input.businessId,
        channel: input.channel,
        external_user_id: input.externalUserId,
        client_name: input.clientName || "Гость",
        client_phone: input.clientPhone || "",
        summary: cleanMsg.slice(0, 120),
        last_message_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    conv = created;
  } else {
    await admin
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        summary: cleanMsg.slice(0, 120),
      })
      .eq("id", conv.id);
  }

  if (conv?.id) {
    await admin.from("messages").insert({
      conversation_id: conv.id,
      business_id: input.businessId,
      sender: "client",
      content: cleanMsg,
    });
  }

  if (aiConfig && !aiConfig.ai_enabled) {
    return {
      reply:
        input.channel === "web"
          ? "ИИ-ассистент сейчас на паузе. Свяжитесь с нами по контактам на витрине."
          : null,
      conversationId: conv?.id,
      paused: true,
    };
  }

  if (conv?.ai_paused) {
    return {
      reply:
        input.channel === "web"
          ? "К диалогу подключился менеджер — скоро ответим вам лично."
          : null,
      conversationId: conv.id,
      paused: true,
    };
  }

  const { data: historyRows } = conv?.id
    ? await admin
        .from("messages")
        .select("sender, content")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(14)
    : { data: [] };

  const history: MessageRow[] = ((historyRows as MessageRow[]) || []).reverse();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallback = buildDemoReply(biz, products, cleanMsg);
    if (conv?.id) {
      await admin.from("messages").insert({
        conversation_id: conv.id,
        business_id: input.businessId,
        sender: "ai",
        content: fallback,
      });
    }
    return { reply: fallback, conversationId: conv?.id };
  }

  const catalogText =
    products.length > 0
      ? products
          .map(
            (p) =>
              `- [ID: ${p.id}] ${p.name} — ${p.price} ₸${p.description ? ` (${p.description})` : ""}`
          )
          .join("\n")
      : "Каталог пока пуст.";

  const dailyNotesBlock = aiConfig?.daily_notes?.trim()
    ? `\nВАЖНЫЕ ОБНОВЛЕНИЯ НА СЕГОДНЯ ОТ ВЛАДЕЛЬЦА:\n${aiConfig.daily_notes.trim()}\n`
    : "";

  const paymentMethodsList: string[] = [];
  if (biz.kaspi_pay_link) paymentMethodsList.push("Kaspi Pay (по ссылке / QR)");
  if (biz.halyk_enabled) paymentMethodsList.push("Halyk Bank");
  const paymentHint =
    paymentMethodsList.length > 0 ? paymentMethodsList.join(", ") : "Уточняется у менеджера";

  const systemInstruction = `${
    aiConfig?.system_prompt ||
    `Ты вежливый, живой и продающий ИИ-администратор компании «${biz.name}».`
  }

ДАННЫЕ КОМПАНИИ:
- Название: ${biz.name}
- Сфера деятельности: ${biz.category || "Бизнес"}
- Город: ${biz.city || "Казахстан"}
- Описание: ${biz.services_description || biz.tagline || "—"}
- Адрес: ${biz.address || "—"}
- График работы: ${biz.working_hours || "—"}
- Доступная оплата: ${paymentHint}
- Контакты: тел. ${biz.phone || "—"}, WhatsApp ${biz.whatsapp || "—"}, Telegram ${biz.telegram || "—"}
${dailyNotesBlock}
АКТУАЛЬНЫЙ КАТАЛОГ (никогда не выдумывай товары и цены вне этого списка):
${catalogText}

ПРАВИЛА РАБОТЫ:
1. Отвечай коротко (2–4 предложения), естественно, на языке клиента (русский или казахский).
2. Если клиент хочет купить/заказать, уточни выбранные позиции, его имя, номер телефона и адрес/комментарий. Как только всё получено — вызови инструмент create_order.
3. Если клиент просит особую скидку, злится или задает сложный вопрос не по базе — вызови инструмент call_manager.`;

  const contents: { role: "user" | "model"; parts: GeminiPart[] }[] = [];
  for (const row of history) {
    const role: "user" | "model" = row.sender === "client" ? "user" : "model";
    const last = contents[contents.length - 1];
    if (last && last.role === role && last.parts[0]?.text) {
      last.parts[0].text += "\n" + row.content;
    } else {
      contents.push({ role, parts: [{ text: row.content }] });
    }
  }
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: cleanMsg }] });
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const firstRes = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      tools: GEMINI_TOOLS,
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!firstRes.ok) {
    return {
      reply: "Извините, временная задержка ответа. Попробуйте повторить через минуту.",
      conversationId: conv?.id,
    };
  }

  const firstData = await firstRes.json();
  const modelParts: GeminiPart[] = firstData?.candidates?.[0]?.content?.parts || [];
  const fnCallPart = modelParts.find((p) => p.functionCall);

  let finalReply =
    modelParts.find((p) => p.text)?.text || "Подскажите, пожалуйста, чем могу помочь?";
  let orderCreated: { orderCode: string; totalPrice: number } | null = null;

  if (fnCallPart?.functionCall) {
    const { name, args = {} } = fnCallPart.functionCall;
    let toolResponse: Record<string, unknown> = { ok: false };

    if (name === "create_order") {
      const clientName = String(args.client_name || conv?.client_name || "Клиент").trim();
      const clientPhone = String(args.client_phone || conv?.client_phone || "").trim();
      const comment = String(args.comment || "").trim();
      const rawItems = Array.isArray(args.items) ? args.items : [];

      const prodMap = new Map(products.map((p) => [p.id, p]));
      const verifiedItems = rawItems
        .map((it: { product_id?: string; quantity?: number }) => {
          const found = prodMap.get(String(it.product_id || ""));
          if (!found) return null;
          const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
          return {
            productId: found.id,
            name: found.name,
            price: found.price,
            quantity: qty,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (verifiedItems.length > 0 && clientPhone) {
        const totalPrice = verifiedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const orderCode = "ORD-" + Math.floor(1000 + Math.random() * 9000);

        const { data: existingClient } = await admin
          .from("clients")
          .select("*")
          .eq("business_id", input.businessId)
          .eq("phone", clientPhone)
          .maybeSingle();

        let clientId: string | null = null;
        if (existingClient) {
          clientId = existingClient.id;
          await admin
            .from("clients")
            .update({
              name: clientName,
              orders_count: (existingClient.orders_count || 0) + 1,
              total_spent: (existingClient.total_spent || 0) + totalPrice,
              last_order_at: new Date().toISOString(),
            })
            .eq("id", existingClient.id);
        } else {
          const { data: newClient } = await admin
            .from("clients")
            .insert({
              business_id: input.businessId,
              name: clientName,
              phone: clientPhone,
              orders_count: 1,
              total_spent: totalPrice,
              last_order_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          clientId = newClient?.id || null;
        }

        await admin.from("orders").insert({
          order_code: orderCode,
          business_id: input.businessId,
          client_id: clientId,
          client_name: clientName,
          client_phone: clientPhone,
          comment,
          items: verifiedItems,
          total_price: totalPrice,
          status: "new",
          source: input.channel,
          payment_method: biz.kaspi_pay_link ? "Kaspi Pay" : "Согласуем с менеджером",
          delivery_method: "Уточняется в чате",
        });

        if (conv?.id) {
          await admin
            .from("conversations")
            .update({
              client_name: clientName,
              client_phone: clientPhone,
              tag: "ordered",
              summary: `Оформлен заказ ${orderCode} на ${totalPrice} ₸`,
            })
            .eq("id", conv.id);
        }

        if (channels?.owner_telegram_chat_id) {
          await notifyOwnerNewOrder({
            chatId: channels.owner_telegram_chat_id,
            businessName: biz.name,
            orderCode,
            source: input.channel,
            clientName,
            clientPhone,
            paymentMethod: biz.kaspi_pay_link ? "Kaspi Pay" : "Согласуем с менеджером",
            deliveryMethod: "Уточняется в чате",
            comment,
            items: verifiedItems,
            totalPrice,
          });
        }

        orderCreated = { orderCode, totalPrice };
        toolResponse = {
          ok: true,
          order_code: orderCode,
          total_price: totalPrice,
          kaspi_pay_link: biz.kaspi_pay_link || "",
        };
      } else {
        toolResponse = {
          ok: false,
          error: "Не удалось найти товары по ID или отсутствует телефон клиента.",
        };
      }
    }

    if (name === "call_manager") {
      const reason = String(args.reason || "Клиенту нужна помощь менеджера");
      if (conv?.id) {
        await admin
          .from("conversations")
          .update({
            ai_paused: true,
            tag: "needs_human",
            summary: reason.slice(0, 140),
          })
          .eq("id", conv.id);
      }

      if (channels?.owner_telegram_chat_id) {
        await notifyOwnerHandoff({
          chatId: channels.owner_telegram_chat_id,
          businessName: biz.name,
          channel: input.channel,
          clientName: conv?.client_name || input.clientName || "Клиент",
          clientPhone: conv?.client_phone || input.clientPhone,
          reason,
          lastMessage: cleanMsg,
        });
      }

      toolResponse = { ok: true, status: "manager_notified" };
    }

    const secondRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [
          ...contents,
          { role: "model", parts: modelParts },
          {
            role: "user",
            parts: [{ functionResponse: { name, response: toolResponse } }],
          },
        ],
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (secondRes.ok) {
      const secondData = await secondRes.json();
      const text = secondData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) finalReply = text;
    } else if (orderCreated) {
      finalReply = `Спасибо! Заказ ${orderCreated.orderCode} на сумму ${orderCreated.totalPrice} ₸ оформлен и передан менеджеру.`;
    }
  }

  if (conv?.id && finalReply) {
    await admin.from("messages").insert({
      conversation_id: conv.id,
      business_id: input.businessId,
      sender: "ai",
      content: finalReply,
    });
  }

  return { reply: finalReply, conversationId: conv?.id, orderCreated };
}

function buildDemoReply(
  biz: {
    name: string;
    city?: string;
    address?: string;
    working_hours?: string;
    phone?: string;
    whatsapp?: string;
  },
  products: ProductRow[],
  message: string
): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("меню") ||
    lower.includes("прайс") ||
    lower.includes("цен") ||
    lower.includes("каталог")
  ) {
    const list = products
      .slice(0, 6)
      .map((p) => `• ${p.name} — ${p.price} ₸`)
      .join("\n");
    return list
      ? `Актуальные позиции «${biz.name}»:\n${list}\n\nНапишите, что хотите заказать, или выберите товары прямо на витрине.`
      : `Каталог «${biz.name}» скоро обновится.`;
  }
  return `Здравствуйте! Я ИИ-ассистент «${biz.name}». Спросите меня про каталог, цены или помогу оформить заказ!`;
}
