import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> | { slug: string } }
) {
  const { slug } = await Promise.resolve(context.params);

  let name = "TIYIN Space";
  let shortName = "TIYIN";
  let description = "Онлайн-витрина и быстрый заказ";
  let logoUrl = "";

  try {
    const admin = getSupabaseAdmin();
    const { data: biz } = await admin
      .from("businesses")
      .select("name, tagline, logo_url, pwa_enabled")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (biz && biz.pwa_enabled !== false) {
      name = biz.name || name;
      shortName = (biz.name || shortName).slice(0, 16);
      description = biz.tagline || description;
      logoUrl = (biz.logo_url || "").trim();
    }
  } catch {
    // Используем дефолтные значения при ошибке чтения
  }

  const icons = logoUrl
    ? [
        { src: logoUrl, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: logoUrl, sizes: "512x512", type: "image/png", purpose: "any" },
      ]
    : [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      ];

  const manifest = {
    id: `/${slug}`,
    name,
    short_name: shortName,
    description,
    start_url: `/${slug}?source=pwa`,
    scope: `/${slug}`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F7F9",
    theme_color: "#0A0A0A",
    icons,
  };

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
