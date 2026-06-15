import { NextRequest } from "next/server";
import { jsonOk, requireAdmin } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: slots } = await admin
    .from("daily_challenge_slots")
    .select(
      `
      id,
      challenge_date,
      template:challenge_templates (title, reward_sk)
    `
    )
    .gte("challenge_date", sinceStr);

  const slotIds = (slots ?? []).map((s) => s.id as string);
  if (!slotIds.length) return jsonOk({ stats: [] });

  const { data: progressRows } = await admin
    .from("player_challenge_progress")
    .select("slot_id, completed, reward_claimed")
    .in("slot_id", slotIds);

  const byTemplate = new Map<
    string,
    { title: string; timesShown: number; started: number; completed: number; skPaid: number }
  >();

  for (const slot of slots ?? []) {
    const template = Array.isArray(slot.template) ? slot.template[0] : slot.template;
    if (!template) continue;
    const title = template.title as string;
    const rewardSk = Number(template.reward_sk ?? 0);
    const entry = byTemplate.get(title) ?? {
      title,
      timesShown: 0,
      started: 0,
      completed: 0,
      skPaid: 0,
    };
    entry.timesShown += 1;
    byTemplate.set(title, entry);

    const slotProgress = (progressRows ?? []).filter((p) => p.slot_id === slot.id);
    entry.started += slotProgress.length;
    for (const p of slotProgress) {
      if (p.completed) entry.completed += 1;
      if (p.reward_claimed) entry.skPaid += rewardSk;
    }
  }

  const stats = [...byTemplate.values()].map((row) => ({
    title: row.title,
    timesShown: row.timesShown,
    startedBy: row.started,
    completedBy: row.completed,
    completionRate: row.started > 0 ? Math.round((row.completed / row.started) * 100) : 0,
    skPaidOut: row.skPaid,
  }));

  stats.sort((a, b) => b.timesShown - a.timesShown);

  return jsonOk({ stats });
}
