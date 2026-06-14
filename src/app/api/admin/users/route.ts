import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { ADMIN_OWNER_ID } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = auth.slice(7);
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service not configured" }, { status: 503 });
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(token);
  if (authErr || !user || user.id !== ADMIN_OWNER_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all auth users
  const {
    data: { users: authUsers },
    error: listErr,
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const [{ data: profiles }, { data: wallets }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, total_matches, total_wins, total_earnings, created_at"),
    supabase
      .from("wallets")
      .select("user_id, balance, total_deposited, total_withdrawn"),
  ]);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
  const walletMap = new Map(wallets?.map((w) => [w.user_id, w]) ?? []);

  const merged = authUsers.map((u) => {
    const profile = profileMap.get(u.id);
    const wallet = walletMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      username: profile?.username ?? u.email?.split("@")[0] ?? "—",
      total_matches: profile?.total_matches ?? 0,
      total_wins: profile?.total_wins ?? 0,
      total_earnings: profile?.total_earnings ?? 0,
      balance: wallet?.balance ?? 0,
      total_deposited: wallet?.total_deposited ?? 0,
      total_withdrawn: wallet?.total_withdrawn ?? 0,
    };
  });

  return NextResponse.json(merged);
}
