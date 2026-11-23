import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function shortHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> | { slug: string } }
) {
  const { slug } = await Promise.resolve(context.params);

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
  const icon192 = `/api/pwa/icon/${encodedSlug}?size=192&v=${version}`;
  const icon512 = `/api/pwa/icon/${encodedSlug}?size=512&v=${version}`;

  const manifest = {
    id: `/${encodedSlug}`,
    name: fullName,
    short_name: shortName,
    description,
    start_url: `/${encodedSlug}?source=pwa`,
    scope: `/${encodedSlug}`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
