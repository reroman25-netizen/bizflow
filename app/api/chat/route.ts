import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const businessId = String(body.businessId || "");
    const message = String(body.message || "").trim();

    if (!businessId || !message) {
      return NextResponse.json({ reply: "Напишите ваш вопрос, я с радостью помогу!" });
    }

    const admin = getSupabaseAdmin();

    const [bizRes, aiRes, prodRes] = await Promise.all([
      admin.from("businesses").select("*").eq("id", businessId).maybeSingle(),
      admin
        .from("business_ai_configs")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle(),
      admin
        .from("products")
        .select("name, price, description, category")
        .eq("business_id", businessId)
        .eq("is_available", true),
    ]);

    const biz = bizRes.data;
    const aiConfig = aiRes.data;
    const products = prodRes.data || [];

    if (!biz) {
      return NextResponse.json({ reply: "Компания не найдена." });
    }

    if (aiConfig && !aiConfig.ai_enabled) {
      return NextResponse.json({
        reply: "ИИ-ассистент сейчас на паузе. Свяжитесь с нами по контактам на витрине.",
      });
    }

    const catalogText =
      products.length > 0
        ? products
            .map(
              (p: { name: string; price: number; description?: string }) =>
                `- ${p.name}: ${p.price} ₸${p.description ? ` (${p.description})` : ""}`
            )
            .join("\n")
        : "Каталог пока пуст.";

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const systemInstruction = `${
        aiConfig?.system_prompt ||
        `Ты вежливый ИИ-администратор компании «${biz.name}».`
      }

Информация о компании:
- Название: ${biz.name}
- Город: ${biz.city || "Казахстан"}
- Описание: ${biz.services_description || biz.tagline || "—"}
- Адрес: ${biz.address || "—"}
- График работы: ${biz.working_hours || "—"}
- Контакты: телефон ${biz.phone || "—"}, WhatsApp ${biz.whatsapp || "—"}, Telegram ${biz.telegram || "—"}

Актуальный каталог (используй только эти цены):
${catalogText}

Отвечай коротко (2–4 предложения), вежливо и на языке клиента (русский или казахский).`;

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
          "Извините, не удалось сформировать ответ.";
        return NextResponse.json({ reply: replyText });
      }
    }

    const lower = message.toLowerCase();
    if (
      lower.includes("меню") ||
      lower.includes("прайс") ||
      lower.includes("цен") ||
      lower.includes("услуг") ||
      lower.includes("каталог")
    ) {
      const list = products
        .slice(0, 6)
        .map((p: { name: string; price: number }) => `• ${p.name} — ${p.price} ₸`)
        .join("\n");
      return NextResponse.json({
        reply: list
          ? `Вот актуальные позиции в «${biz.name}»:\n${list}\n\nВы можете выбрать нужные позиции прямо на витрине и отправить заказ.`
          : `Каталог «${biz.name}» скоро обновится. Вы можете связаться с нами по контактам на странице.`,
      });
    }

    if (lower.includes("адрес") || lower.includes("график") || lower.includes("контакт")) {
      return NextResponse.json({
        reply: `Мы находимся: ${[biz.city, biz.address].filter(Boolean).join(", ") || "уточняйте у менеджера"}. График работы: ${biz.working_hours || "ежедневно"}. Телефон: ${biz.phone || biz.whatsapp || "указан на витрине"}.`,
      });
    }

    return NextResponse.json({
      reply: `Здравствуйте! Я ИИ-ассистент «${biz.name}». Спросите меня про каталог, цены, адрес или график работы — с радостью подскажу!`,
    });
  } catch {
    return NextResponse.json(
      { reply: "Ошибка сервера. Попробуйте еще раз чуть позже." },
      { status: 500 }
    );
  }
}
