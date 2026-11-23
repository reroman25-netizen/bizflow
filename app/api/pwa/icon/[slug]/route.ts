import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import React from "react";

export const dynamic = "force-dynamic";

function getInitials(text: string): string {
  const clean = text.trim();
  if (!clean) return "TS";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> | { slug: string } }
) {
  const { slug } = await Promise.resolve(context.params);
  const sizeParam = Number(req.nextUrl.searchParams.get("size") || "512");
  const size = Number.isFinite(sizeParam)
    ? Math.max(64, Math.min(512, Math.round(sizeParam)))
    : 512;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let businessName = "TIYIN";
  let logoUrl = "";

  if (supabaseUrl && supabaseKey && slug) {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await supabase
      .from("businesses")
      .select("name, pwa_short_name, logo_url")
      .eq("slug", slug)
      .maybeSingle();

    if (data) {
      businessName = (data.pwa_short_name || data.name || "TIYIN").trim();
      logoUrl = (data.logo_url || "").trim();
    }
  }

  // Если у бизнеса загружен свой логотип — отдаём его с нашего домена (для стабильной работы iOS и Android)
  if (logoUrl) {
    try {
      const imgRes = await fetch(logoUrl, { cache: "no-store" });
      if (imgRes.ok) {
        const contentType = (imgRes.headers.get("content-type") || "").toLowerCase();
        const arrayBuffer = await imgRes.arrayBuffer();

        if (
          contentType.includes("image/png") ||
          contentType.includes("image/jpeg") ||
          contentType.includes("image/jpg")
        ) {
          return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
              "Content-Type": contentType.includes("png")
                ? "image/png"
                : "image/jpeg",
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        }
      }
    } catch {
      // Если внешний файл недоступен — сгенерируем аккуратную иконку с инициалами бизнеса
    }
  }

  // Запасной вариант: стильная квадратная PNG-иконка с инициалами самого бизнеса
  const initials = getInitials(businessName);
  const fontSize = Math.round(size * 0.42);

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
          color: "#ffffff",
          fontSize: `${fontSize}px`,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          fontFamily: "sans-serif",
        },
      },
      initials
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );
}
