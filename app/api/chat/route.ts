import { NextRequest, NextResponse } from "next/server";
import { runAiEngine } from "@/lib/aiEngine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const businessId = String(body.businessId || "");
    const message = String(body.message || "").trim();
    const sessionId = String(body.sessionId || "web-guest");

    if (!businessId || !message) {
      return NextResponse.json({ reply: "Напишите ваш вопрос, я с радостью помогу!" });
    }

    const result = await runAiEngine({
      businessId,
      channel: "web",
      externalUserId: sessionId,
      clientName: body.clientName ? String(body.clientName) : undefined,
      message,
    });

    return NextResponse.json({
      reply: result.reply || "Диалог передан менеджеру.",
      conversationId: result.conversationId,
      orderCreated: result.orderCreated || null,
    });
  } catch {
    return NextResponse.json(
      { reply: "Ошибка сервера. Попробуйте еще раз чуть позже." },
      { status: 500 }
    );
  }
}
