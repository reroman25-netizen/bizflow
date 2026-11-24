import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  notifyRecipientsKaspiReceipt,
  resolveOrderRecipientChatIds,
} from "@/lib/telegramNotify";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function getExtension(file: File): string {
  const mime = (file.type || "").toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  const parts = (file.name || "").split(".");
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : "";
  if (ext && ["jpg", "jpeg", "png", "webp", "pdf"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return "jpg";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const orderId = String(formData.get("orderId") || "").trim();
    const orderCode = String(formData.get("orderCode") || "").trim();
    const businessId = String(formData.get("businessId") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Выберите файл чека (фото или PDF)." },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Размер файла не должен превышать 10 МБ." },
        { status: 400 }
      );
    }

    const ext = getExtension(file);
    const mime = (file.type || "").toLowerCase();
    const isPdf = mime === "application/pdf" || ext === "pdf";

    if (mime && !ALLOWED_MIME.has(mime) && !isPdf) {
      return NextResponse.json(
        { error: "Поддерживаются только фото (JPG, PNG, WebP) и PDF-чеки." },
        { status: 400 }
      );
    }

    if (!orderCode || (!orderId && !businessId)) {
      return NextResponse.json(
        { error: "Не указаны данные заказа." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Находим заказ и проверяем совпадение order_code
    let orderQuery = admin
      .from("orders")
      .select("id, order_code, business_id, client_name, client_phone, total_price")
      .eq("order_code", orderCode);

    if (orderId) {
      orderQuery = orderQuery.eq("id", orderId);
    } else {
      orderQuery = orderQuery.eq("business_id", businessId);
    }

    const { data: orderRow, error: findErr } = await orderQuery.maybeSingle();

    if (findErr || !orderRow) {
      return NextResponse.json(
        { error: "Заказ не найден. Проверьте номер заказа." },
        { status: 404 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const safeCode = orderRow.order_code.replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = `${orderRow.business_id}/${safeCode}-${Date.now()}.${ext}`;
    const contentType = isPdf
      ? "application/pdf"
      : mime || (ext === "png" ? "image/png" : "image/jpeg");

    // Пробуем загрузить в бакет order-receipts, при отсутствии — запасной business-media
    let usedBucket = "order-receipts";
    let uploadErr = (
      await admin.storage.from(usedBucket).upload(filePath, bytes, {
        contentType,
        upsert: true,
      })
    ).error;

    if (uploadErr) {
      usedBucket = "business-media";
      const fallbackPath = `receipts/${filePath}`;
      const fallbackRes = await admin.storage
        .from(usedBucket)
        .upload(fallbackPath, bytes, {
          contentType,
          upsert: true,
        });
      uploadErr = fallbackRes.error;
      if (!uploadErr) {
        const { data: pubData } = admin.storage
          .from(usedBucket)
          .getPublicUrl(fallbackPath);
        const receiptUrl = pubData.publicUrl;
        return await finalizeReceipt({
          admin,
          orderRow,
          receiptUrl,
          isPdf,
        });
      }
      return NextResponse.json(
        { error: uploadErr.message || "Не удалось сохранить чек." },
        { status: 500 }
      );
    }

    const { data: pubData } = admin.storage.from(usedBucket).getPublicUrl(filePath);
    const receiptUrl = pubData.publicUrl;

    return await finalizeReceipt({
      admin,
      orderRow,
      receiptUrl,
      isPdf,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка загрузки чека" },
      { status: 500 }
    );
  }
}

async function finalizeReceipt(params: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  orderRow: {
    id: string;
    order_code: string;
    business_id: string;
    client_name: string;
    client_phone: string;
    total_price: number;
  };
  receiptUrl: string;
  isPdf: boolean;
}) {
  const { admin, orderRow, receiptUrl, isPdf } = params;

  const { error: updErr } = await admin
    .from("orders")
    .update({
      receipt_url: receiptUrl,
      receipt_uploaded_at: new Date().toISOString(),
      payment_status: "pending_review",
    })
    .eq("id", orderRow.id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const [bizRes, chanRes] = await Promise.all([
    admin
      .from("businesses")
      .select("name")
      .eq("id", orderRow.business_id)
      .maybeSingle(),
    admin
      .from("business_channels")
      .select("owner_telegram_chat_id, telegram_order_recipients")
      .eq("business_id", orderRow.business_id)
      .maybeSingle(),
  ]);

  const chatIds = resolveOrderRecipientChatIds(
    chanRes.data?.owner_telegram_chat_id,
    chanRes.data?.telegram_order_recipients
  );

  if (chatIds.length > 0) {
    await notifyRecipientsKaspiReceipt({
      chatIds,
      businessName: bizRes.data?.name || "TIYIN Space",
      orderCode: orderRow.order_code,
      clientName: orderRow.client_name,
      clientPhone: orderRow.client_phone,
      totalPrice: orderRow.total_price,
      receiptUrl,
      isPdf,
    });
  }

  return NextResponse.json({
    ok: true,
    receiptUrl,
    paymentStatus: "pending_review",
  });
}
