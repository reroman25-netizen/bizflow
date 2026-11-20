import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const check = await verifyAdminRequest(req.headers.get("authorization"));
    return NextResponse.json({ isAdmin: check.ok });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
