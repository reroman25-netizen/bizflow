import { getSupabaseClient } from "@/lib/supabaseClient";

const BUCKET_NAME = "tiyin-media";
const MAX_FILE_SIZE_MB = 5;

export async function uploadBusinessMedia(params: {
  businessId: string;
  folder: "covers" | "products";
  file: File;
}): Promise<{ url?: string; error?: string }> {
  const { businessId, folder, file } = params;

  if (!file.type.startsWith("image/")) {
    return { error: "Выберите файл изображения (JPG, PNG или WebP)." };
  }

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return { error: `Размер фото не должен превышать ${MAX_FILE_SIZE_MB} МБ.` };
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${businessId}/${folder}/${uniqueName}`;

  const supabase = getSupabaseClient();
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadErr) {
    return { error: uploadErr.message };
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return { url: data.publicUrl };
}
