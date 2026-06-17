import { NextRequest } from "next/server";
import { jsonOk, requireAdmin } from "@/lib/admin-api";
import { sendCreatorEmail } from "@/lib/send-creator-email";

async function resolveAudience(
  admin: NonNullable<ReturnType<typeof import("@/lib/supabase-admin").createAdminClient>>,
  audienceType: string,
  target?: string
) {
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emails: string[] = [];
  const userIds: string[] = [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: profiles } = await admin.from("profiles").select("id, username, created_at");
  const profileIds = (profiles ?? []).map((p) => p.id as string);
  const { data: wallets } = profileIds.length
    ? await admin.from("wallets").select("user_id, balance").in("user_id", profileIds)
    : { data: [] };
  const { data: recentSessions } = await admin
    .from("player_sessions")
    .select("user_id")
    .gte("created_at", sevenDaysAgo);
  const { data: recentMatches } = await admin
    .from("matches")
    .select("player1_id, player2_id, player_a, player_b, created_at")
    .gte("created_at", thirtyDaysAgo);

  const activeSet = new Set((recentSessions ?? []).map((s) => s.user_id as string));
  const playedRecently = new Set<string>();
  for (const m of recentMatches ?? []) {
    for (const id of [m.player1_id, m.player2_id, m.player_a, m.player_b]) {
      if (id) playedRecently.add(id as string);
    }
  }

  const emailMap = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const balanceMap = new Map((wallets ?? []).map((w) => [w.user_id as string, Number(w.balance ?? 0)]));

  for (const u of authUsers?.users ?? []) {
    const id = u.id;
    const email = u.email;
    if (!email) continue;
    const p = profileMap.get(id);

    if (audienceType === "specific" && target) {
      const t = target.toLowerCase();
      const match =
        email.toLowerCase() === t ||
        (p?.username as string | undefined)?.toLowerCase() === t ||
        id === target;
      if (!match) continue;
    } else if (audienceType === "active_7d" && !activeSet.has(id)) continue;
    else if (audienceType === "balance_gt_0" && (balanceMap.get(id) ?? 0) <= 0) continue;
    else if (audienceType === "inactive_30d" && playedRecently.has(id)) continue;

    emails.push(email);
    userIds.push(id);
  }

  return { emails, userIds };
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const { data, error } = await admin
    .from("broadcasts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return jsonOk({ error: error.message }, 500);
  return jsonOk({ broadcasts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin, userId } = ctx;

  const body = (await req.json()) as {
    audienceType?: string;
    target?: string;
    title?: string;
    body?: string;
    ctaText?: string;
    ctaUrl?: string;
    channels?: string[];
  };

  if (!body.title?.trim() || !body.body?.trim() || !body.audienceType) {
    return jsonOk({ error: "title, body, and audienceType required" }, 400);
  }

  const channels = body.channels ?? ["in_app"];
  const { emails, userIds } = await resolveAudience(admin, body.audienceType, body.target);

  const { data: broadcast, error } = await admin
    .from("broadcasts")
    .insert({
      audience_type: body.audienceType,
      title: body.title.trim(),
      body: body.body.trim(),
      cta_text: body.ctaText?.trim() ?? null,
      cta_url: body.ctaUrl?.trim() ?? null,
      channels,
      delivered_count: userIds.length,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) return jsonOk({ error: error.message }, 400);

  if (channels.includes("in_app") && userIds.length) {
    const notifications = userIds.map((uid) => ({
      user_id: uid,
      title: body.title!.trim(),
      body: body.body!.trim(),
      cta_text: body.ctaText?.trim() ?? null,
      cta_url: body.ctaUrl?.trim() ?? null,
      broadcast_id: broadcast.id,
    }));
    await admin.from("notifications").insert(notifications);
  }

  if (channels.includes("email")) {
    for (const email of emails.slice(0, 100)) {
      void sendCreatorEmail({
        type: "application_received",
        to: email,
        creatorName: body.title!.trim(),
      });
    }
  }

  return jsonOk({ success: true, delivered: userIds.length, broadcastId: broadcast.id });
}
