import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Not configured" },
        { status: 503 }
      );
    }

    await supabase.from("error_reports").insert({
      user_id: body.userId || null,
      username: body.username || "anonymous",
      error_message: body.errorMessage ?? "",
      error_stack: (body.errorStack || "").substring(0, 5000),
      page_url: body.pageUrl ?? "",
      user_description: body.userDescription ?? "",
      device_info: body.deviceInfo ?? "",
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error report save failed:", err);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
