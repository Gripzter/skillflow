import { NextRequest } from "next/server";
import { jsonOk, jsonError, requireAdmin } from "@/lib/admin-api";
import { getOrCreateTodaysChallenges } from "@/lib/challengeRotation";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const dateStr = new Date().toISOString().slice(0, 10);
  await getOrCreateTodaysChallenges(false);

  const [{ data: templates }, { data: slots }] = await Promise.all([
    admin.from("challenge_templates").select("*").order("created_at", { ascending: false }),
    admin
      .from("daily_challenge_slots")
      .select(
        `
        id,
        challenge_date,
        slot,
        template_id,
        template:challenge_templates (*)
      `
      )
      .eq("challenge_date", dateStr)
      .order("slot", { ascending: true }),
  ]);

  const slotIds = (slots ?? []).map((s) => s.id as string);
  let slotStats: Record<string, { started: number; completed: number }> = {};

  if (slotIds.length) {
    const { data: progressRows } = await admin
      .from("player_challenge_progress")
      .select("slot_id, completed")
      .in("slot_id", slotIds);

    for (const id of slotIds) {
      slotStats[id] = { started: 0, completed: 0 };
    }
    for (const row of progressRows ?? []) {
      const sid = row.slot_id as string;
      if (!slotStats[sid]) slotStats[sid] = { started: 0, completed: 0 };
      slotStats[sid].started += 1;
      if (row.completed) slotStats[sid].completed += 1;
    }
  }

  const todaySlots = (slots ?? []).map((row) => {
    const template = Array.isArray(row.template) ? row.template[0] : row.template;
    const stats = slotStats[row.id as string] ?? { started: 0, completed: 0 };
    return {
      id: row.id,
      slot: row.slot,
      template,
      startedCount: stats.started,
      completedCount: stats.completed,
    };
  });

  return jsonOk({ templates: templates ?? [], todaySlots, challengeDate: dateStr });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin, userId } = ctx;

  const body = (await req.json()) as {
    title?: string;
    description?: string | null;
    game?: string;
    challenge_type?: string;
    target_value?: number;
    reward_sk?: number;
    difficulty?: string;
    is_active?: boolean;
  };

  if (!body.title?.trim()) return jsonError("Title is required");
  if (!body.game) return jsonError("Game is required");
  if (!body.challenge_type) return jsonError("Challenge type is required");
  if (!body.target_value || body.target_value <= 0) return jsonError("Target must be > 0");
  if (!body.reward_sk || body.reward_sk < 50 || body.reward_sk > 500) {
    return jsonError("Reward must be between 50 and 500 SK");
  }

  const { data, error } = await admin
    .from("challenge_templates")
    .insert({
      title: body.title.trim(),
      description: body.description?.trim() || null,
      game: body.game,
      challenge_type: body.challenge_type,
      target_value: body.target_value,
      reward_sk: body.reward_sk,
      difficulty: body.difficulty ?? "normal",
      is_active: body.is_active ?? true,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk({ template: data });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as {
    id?: string;
    title?: string;
    description?: string | null;
    game?: string;
    challenge_type?: string;
    target_value?: number;
    reward_sk?: number;
    difficulty?: string;
    is_active?: boolean;
  };

  if (!body.id) return jsonError("Template id required");

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.game !== undefined) patch.game = body.game;
  if (body.challenge_type !== undefined) patch.challenge_type = body.challenge_type;
  if (body.target_value !== undefined) patch.target_value = body.target_value;
  if (body.reward_sk !== undefined) patch.reward_sk = body.reward_sk;
  if (body.difficulty !== undefined) patch.difficulty = body.difficulty;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  const { data, error } = await admin
    .from("challenge_templates")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk({ template: data });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("Template id required");

  const { error } = await admin.from("challenge_templates").delete().eq("id", id);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ success: true });
}
