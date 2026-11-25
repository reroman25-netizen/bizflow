import { NextRequest, NextResponse } from "next/server";
import { runDeliveryWorkerTick } from "@/lib/deliveryEngine";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const querySecret = (req.nextUrl.searchParams.get("secret") || "").trim();
  return auth === secret || querySecret === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const stats = await runDeliveryWorkerTick();
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Worker error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
