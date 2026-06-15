import { NextRequest } from "next/server";
import { jsonOk, requireAdmin } from "@/lib/admin-api";

const SETTING_KEYS = [
  "min_deposit_usd",
  "min_withdrawal_usd",
  "max_entry_sk",
  "default_creator_share",
  "match_timeout_minutes",
  "auto_void_minutes",
  "maintenance_mode",
  "fixed_costs_usd",
];

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const [{ data: settings }, { data: logs }, { data: sessions }] = await Promise.all([
    admin.from("platform_settings").select("*").in("key", SETTING_KEYS),
    admin
      .from("platform_settings_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("admin_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const map: Record<string, string> = {};
  for (const s of settings ?? []) {
    map[s.key as string] = s.value as string;
  }

  return jsonOk({
    settings: map,
    changeLog: logs ?? [],
    adminSessions: sessions ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin, userId } = ctx;

  const body = (await req.json()) as { key?: string; value?: string; action?: string };

  if (body.action === "kill_sessions") {
    await admin
      .from("admin_sessions")
      .update({ ended_at: new Date().toISOString() })
      .is("ended_at", null);
    return jsonOk({ success: true });
  }

  if (!body.key || body.value === undefined) {
    return jsonOk({ error: "key and value required" }, 400);
  }

  const { data: existing } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", body.key)
    .maybeSingle();

  await admin.from("platform_settings").upsert({
    key: body.key,
    value: body.value,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });

  await admin.from("platform_settings_log").insert({
    setting_key: body.key,
    old_value: existing?.value ?? null,
    new_value: body.value,
    updated_by: userId,
  });

  return jsonOk({ success: true });
}
