import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function shortHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}): Promise<Metadata> {
  const { slug } = await Promise.resolve(params);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let fullName = "TIYIN Space";
  let shortName = "TIYIN";
  let description = "Онлайн-витрина";
  let logoUrl = "";

  if (supabaseUrl && supabaseKey && slug) {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await supabase
      .from("businesses")
      .select("name, pwa_short_name, tagline, logo_url")
      .eq("slug", slug)
      .maybeSingle();

    if (data) {
      fullName = (data.name || "TIYIN Space").trim();
      const customShort = (data.pwa_short_name || "").trim();
      shortName = customShort || fullName.slice(0, 12).trim();
      description = (data.tagline || fullName).trim();
      logoUrl = (data.logo_url || "").trim();
    }
  }

  const version = shortHash(`${logoUrl}|${shortName}`);
  const encodedSlug = encodeURIComponent(slug);
  const appleIconUrl = `/api/pwa/icon/${encodedSlug}?size=180&v=${version}`;
  const icon192Url = `/api/pwa/icon/${encodedSlug}?size=192&v=${version}`;

  return {
    title: shortName,
    description,
    applicationName: shortName,
    manifest: `/api/pwa/manifest/${encodedSlug}?v=${version}`,
    appleWebApp: {
      capable: true,
      title: shortName,
      statusBarStyle: "default",
    },
    icons: {
      icon: [{ url: icon192Url, sizes: "192x192", type: "image/png" }],
      shortcut: icon192Url,
      apple: [{ url: appleIconUrl, sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title: fullName,
      description,
      images: logoUrl ? [{ url: logoUrl }] : undefined,
    },
  };
}

export default function BusinessStorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
