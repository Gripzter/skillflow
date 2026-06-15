import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { claimChallengeReward } from "@/lib/challengeProgress";

function getSupabaseFromRequest(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const authHeader = req.headers.get("authorization");
  return createClient(url, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseFromRequest(req);
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { slotId?: string };
  if (!body.slotId) {
    return NextResponse.json({ error: "slotId required" }, { status: 400 });
  }

  const result = await claimChallengeReward(user.id, body.slotId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
