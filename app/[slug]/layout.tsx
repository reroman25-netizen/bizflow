import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function generateMetadata(props: {
  params: Promise<{ slug: string }> | { slug: string };
}): Promise<Metadata> {
  const { slug } = await Promise.resolve(props.params);

  let title = "TIYIN Space";
  let description = "Онлайн-витрина и быстрый заказ";
  let logoUrl = "/icon-192.png";
  let pwaEnabled = true;

  try {
    const admin = getSupabaseAdmin();
    const { data: biz } = await admin
      .from("businesses")
      .select("name, tagline, logo_url, pwa_enabled")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (biz) {
      title = biz.name || title;
      description = biz.tagline || description;
      if (biz.logo_url && String(biz.logo_url).trim()) {
        logoUrl = String(biz.logo_url).trim();
      }
      pwaEnabled = biz.pwa_enabled !== false;
    }
  } catch {
    // Fallback metadata
  }

  return {
    title,
    description,
    manifest: pwaEnabled ? `/api/manifest/${slug}` : undefined,
    icons: {
      icon: logoUrl,
      apple: logoUrl,
    },
    appleWebApp: pwaEnabled
      ? {
          capable: true,
          title,
          statusBarStyle: "default",
        }
      : undefined,
  };
}

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
