import { NextRequest } from "next/server";
import { jsonOk, requireAdmin } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const { data, error } = await admin
    .from("creator_invites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return jsonOk({ error: error.message }, 500);

  const acceptedIds = (data ?? [])
    .map((i) => i.accepted_by as string | null)
    .filter(Boolean) as string[];

  const { data: profiles } = acceptedIds.length
    ? await admin.from("profiles").select("id, username").in("id", acceptedIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  const invites = (data ?? []).map((i) => ({
    id: i.id,
    token: i.token,
    tokenShort: `${(i.token as string).slice(0, 8)}…`,
    email: i.email,
    gameNameHint: i.game_name_hint,
    status: i.status,
    expiresAt: i.expires_at,
    acceptedAt: i.accepted_at,
    acceptedBy: i.accepted_by,
    acceptedByName: i.accepted_by ? profileMap.get(i.accepted_by as string) ?? "—" : "—",
    createdAt: i.created_at,
  }));

  return jsonOk({ invites });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin, userId } = ctx;

  const body = (await req.json()) as { email?: string; gameNameHint?: string };

  const { data, error } = await admin.rpc("generate_invite_token", {
    p_email: body.email ?? null,
    p_game_hint: body.gameNameHint ?? null,
    p_admin_id: userId,
  });

  if (error) return jsonOk({ error: error.message }, 400);
  return jsonOk({ inviteUrl: data as string });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as { token?: string };
  if (!body.token) return jsonOk({ error: "token required" }, 400);

  const { data, error } = await admin.rpc("revoke_invite_token", {
    p_token: body.token,
  });

  if (error) return jsonOk({ error: error.message }, 400);
  return jsonOk({ revoked: Boolean(data) });
}
