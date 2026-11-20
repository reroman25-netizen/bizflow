import { NextRequest, NextResponse } from "next/server";

interface ChatProduct {
  name: string;
  price: number;
  description: string;
  category: string;
  isAvailable: boolean;
}

interface ChatRequestBody {
  message: string;
  businessName: string;
  aiPrompt?: string;
  products: ChatProduct[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const message = (body.message || "").trim();
    const businessName = body.businessName || "Бизнес";
    const products = Array.isArray(body.products) ? body.products : [];
    const availableProducts = products.filter((p) => p.isAvailable);

    if (!message) {
      return NextResponse.json({ reply: "Напишите ваш вопрос, я с радостью помогу!" });
    }

    const menuText = availableProducts
      .map((p) => `- ${p.name}: ${p.price} ₸ (${p.description})`)
      .join("\n");

    const apiKey = process.env.GEMINI_API_KEY;

    // Если добавлен GEMINI_API_KEY в .env.local или Vercel — вызываем реальный Gemini API
    if (apiKey) {
      const systemInstruction = `${
        body.aiPrompt || `Ты вежливый ИИ-администратор компании «${businessName}».`
      }\n\nАктуальный прайс-лист (используй только эти цены):\n${menuText}\n\nОтвечай коротко (2–4 предложения), дружелюбно, на языке клиента (русский или казахский).`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: "user", parts: [{ text: message }] }],
          }),
        }
      );

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const replyText =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "Извините, не удалось сформировать ответ. Попробуйте еще раз.";
        return NextResponse.json({ reply: replyText, mode: "gemini" });
      }
    }

    // Умный демо-режим (работает сразу без API-ключей)
    const lower = message.toLowerCase();
    let reply = "";

    if (lower.includes("меню") || lower.includes("прайс") || lower.includes("цена") || lower.includes("что есть")) {
      const list = availableProducts
        .slice(0, 5)
        .map((p) => `• ${p.name} — ${p.price} ₸`)
        .join("\n");
      reply = `Вот наши актуальные позиции в «${businessName}»:\n${list}\n\nВы можете добавить их в корзину прямо на этой странице и оплатить через Kaspi Pay.`;
    } else if (lower.includes("каспи") || lower.includes("оплат")) {
      reply =
        "Да, мы принимаем оплату через Kaspi Pay (выставляем счет или QR) и наличными. Просто добавьте нужные позиции в корзину и нажмите «Оформить».";
    } else if (lower.includes("доставк") || lower.includes("адрес") || lower.includes("время")) {
      reply =
        "Доставляем по городу за 35–45 минут, либо можно забрать самовывозом. Укажите адрес при оформлении заказа в корзине.";
    } else {
      const matched = availableProducts.find((p) =>
        lower.includes(p.name.toLowerCase().split(" ")[0])
      );
      if (matched) {
        reply = `Да, «${matched.name}» сейчас в наличии — ${matched.price} ₸ (${matched.description}). Добавить вам в заказ? Просто нажмите «+» на карточке товара!`;
      } else {
        reply = `Здравствуйте! Я ИИ-помощник «${businessName}». Спросите меня про меню, цены, наличие или доставку — я подскажу и помогу оформить заказ.`;
      }
    }

    return NextResponse.json({ reply, mode: "demo" });
  } catch {
    return NextResponse.json(
      { reply: "Произошла ошибка сервера. Попробуйте еще раз." },
      { status: 500 }
    );
  }
}
