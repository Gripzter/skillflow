import { NextRequest } from "next/server";
import { jsonOk, requireAdmin } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const status = new URL(req.url).searchParams.get("status");

  let query = admin
    .from("disputes")
    .select("*, matches(game_type, creator_game_id, stake_sp)")
    .order("created_at", { ascending: true });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: disputes, error } = await query;
  if (error) return jsonOk({ error: error.message }, 500);

  const submitterIds = [...new Set((disputes ?? []).map((d) => d.submitted_by).filter(Boolean))];
  const { data: profiles } = submitterIds.length
    ? await admin.from("profiles").select("id, username").in("id", submitterIds as string[])
    : { data: [] };
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  const now = Date.now();
  const rows = (disputes ?? []).map((d) => {
    const ageHours = Math.floor((now - new Date(d.created_at as string).getTime()) / 3600000);
    const match = d.matches as { game_type?: string; creator_game_id?: string; stake_sp?: number } | null;
    return {
      id: d.id,
      matchId: d.match_id,
      submittedBy: nameMap.get(d.submitted_by as string) ?? "—",
      submittedById: d.submitted_by,
      game: match?.creator_game_id ?? match?.game_type ?? "—",
      reason: d.reason,
      status: d.status,
      resolution: d.resolution,
      resolutionNote: d.resolution_note,
      submittedAt: d.created_at,
      resolvedAt: d.resolved_at,
      ageHours,
    };
  });

  const open = rows.filter((r) => r.status === "open" || r.status === "under_review");
  const resolved = rows.filter((r) => r.status === "resolved");
  const avgResolutionHours =
    resolved.length > 0
      ? resolved.reduce((s, r) => {
          if (!r.resolvedAt) return s;
          return (
            s +
            (new Date(r.resolvedAt).getTime() - new Date(r.submittedAt).getTime()) / 3600000
          );
        }, 0) / resolved.length
      : 0;

  const thisMonth = rows.filter(
    (r) => (r.submittedAt as string).slice(0, 7) === new Date().toISOString().slice(0, 7)
  );

  const resolutionBreakdown = {
    refunded: resolved.filter((r) => r.resolution?.includes("refund")).length,
    voided: resolved.filter((r) => r.resolution === "voided").length,
    dismissed: resolved.filter((r) => r.resolution === "dismissed").length,
  };

  return jsonOk({
    disputes: rows,
    stats: {
      openCount: open.length,
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      thisMonth: thisMonth.length,
      resolutionBreakdown,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin, userId } = ctx;

  const body = (await req.json()) as {
    disputeId?: string;
    status?: string;
    resolution?: string;
    resolutionNote?: string;
  };

  if (!body.disputeId || !body.resolutionNote?.trim()) {
    return jsonOk({ error: "disputeId and resolutionNote required" }, 400);
  }

  const { error } = await admin
    .from("disputes")
    .update({
      status: body.status ?? "resolved",
      resolution: body.resolution,
      resolution_note: body.resolutionNote.trim(),
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", body.disputeId);

  if (error) return jsonOk({ error: error.message }, 400);
  return jsonOk({ success: true });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as { matchId?: string; submittedBy?: string; reason?: string };
  if (!body.matchId || !body.reason?.trim()) {
    return jsonOk({ error: "matchId and reason required" }, 400);
  }

  const { data, error } = await admin
    .from("disputes")
    .insert({
      match_id: body.matchId,
      submitted_by: body.submittedBy ?? null,
      reason: body.reason.trim(),
      status: "open",
    })
    .select("id")
    .single();

  if (error) return jsonOk({ error: error.message }, 400);
  return jsonOk({ id: data.id });
}
