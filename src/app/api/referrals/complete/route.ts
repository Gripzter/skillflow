import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeReferral } from "@/lib/referrals";

const supabaseAdmin =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

/**
 * POST body: { userId: string, amount: number }
 * Used internally (e.g. from webhook or verify-session). Not required for normal flow.
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const { userId, amount } = body as { userId?: string; amount?: number };
    if (!userId || typeof amount !== "number") {
      return NextResponse.json(
        { error: "userId and amount required" },
        { status: 400 }
      );
    }
    await completeReferral(supabaseAdmin, userId, amount);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[referrals/complete]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
