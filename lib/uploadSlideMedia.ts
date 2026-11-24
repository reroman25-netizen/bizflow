import { getSupabaseClient } from "@/lib/supabaseClient";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO_SIZE = 15 * 1024 * 1024; // 15 MB

export async function uploadSlideMedia(params: {
  businessId: string;
  file: File;
}): Promise<{ url?: string; mediaType?: "image" | "video"; error?: string }> {
  const { businessId, file } = params;
  const mime = (file.type || "").toLowerCase();
  const isVideo =
    mime.startsWith("video/") ||
    /\.(mp4|webm|mov|m4v)$/i.test(file.name || "");
  const isImage =
    mime.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name || "");

  if (!isVideo && !isImage) {
    return {
      error: "Выберите фото (JPG, PNG, WebP) или короткое видео (MP4, WebM, MOV).",
    };
  }

  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    return {
      error: "Видео слишком большое. Рекомендуем короткий ролик 10–15 секунд до 15 МБ.",
    };
  }

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return {
      error: "Размер фото не должен превышать 5 МБ.",
    };
  }

  const parts = (file.name || "").split(".");
  const rawExt = parts.length > 1 ? parts.pop()?.toLowerCase() : "";
  const ext =
    rawExt && /^[a-z0-9]{2,5}$/.test(rawExt)
      ? rawExt
      : isVideo
      ? "mp4"
      : "jpg";

  const path = `${businessId}/slides/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from("business-media")
    .upload(path, file, {
      contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      upsert: true,
    });

  if (error) {
    return { error: error.message || "Не удалось загрузить медиафайл." };
  }

  const { data } = supabase.storage.from("business-media").getPublicUrl(path);
  return {
    url: data.publicUrl,
    mediaType: isVideo ? "video" : "image",
  };
}
