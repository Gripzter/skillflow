import { createAdminClient } from "@/lib/supabase-admin";
import { createNotificationsForAllUsers } from "@/lib/notifications";
import type { ChallengeGame } from "@/lib/challengeGames";

export type ChallengeTemplate = {
  id: string;
  title: string;
  description: string | null;
  game: ChallengeGame;
  challenge_type: string;
  target_value: number;
  reward_sk: number;
  bonus_type?: "flat_sk" | "second_chance";
  is_active: boolean;
  difficulty: string;
  created_at: string;
};

export type DailyChallengeSlot = {
  id: string;
  challenge_date: string;
  slot: number;
  template_id: string;
  template: ChallengeTemplate;
};

function todayUtcDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function pickThreeWithVariety(templates: ChallengeTemplate[]): ChallengeTemplate[] {
  if (templates.length <= 3) return templates.slice(0, 3);

  const shuffled = [...templates].sort(() => Math.random() - 0.5);

  for (let attempt = 0; attempt < 40; attempt++) {
    const pick = [...shuffled].sort(() => Math.random() - 0.5).slice(0, 3);
    const games = new Set(pick.map((t) => t.game));
    if (games.size >= 2) return pick;
  }

  const byGame = new Map<ChallengeGame, ChallengeTemplate[]>();
  for (const t of shuffled) {
    const list = byGame.get(t.game as ChallengeGame) ?? [];
    list.push(t);
    byGame.set(t.game as ChallengeGame, list);
  }
  const gameKeys = [...byGame.keys()];
  if (gameKeys.length < 2) return shuffled.slice(0, 3);

  const first = byGame.get(gameKeys[0])![0];
  const second = byGame.get(gameKeys[1])![0];
  const rest = shuffled.filter((t) => t.id !== first.id && t.id !== second.id);
  return [first, second, rest[0] ?? shuffled[2]];
}

async function fetchSlotsForDate(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  dateStr: string
): Promise<DailyChallengeSlot[]> {
  const { data, error } = await admin
    .from("daily_challenge_slots")
    .select(
      `
      id,
      challenge_date,
      slot,
      template_id,
      template:challenge_templates (
        id,
        title,
        description,
        game,
        challenge_type,
        target_value,
        reward_sk,
        bonus_type,
        is_active,
        difficulty,
        created_at
      )
    `
    )
    .eq("challenge_date", dateStr)
    .order("slot", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const template = Array.isArray(row.template) ? row.template[0] : row.template;
      if (!template) return null;
      return {
        id: row.id as string,
        challenge_date: row.challenge_date as string,
        slot: row.slot as number,
        template_id: row.template_id as string,
        template: template as ChallengeTemplate,
      };
    })
    .filter((row): row is DailyChallengeSlot => Boolean(row));
}

async function insertSlotsForDate(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  dateStr: string,
  templates: ChallengeTemplate[]
): Promise<DailyChallengeSlot[]> {
  const picks = pickThreeWithVariety(templates);
  const rows = picks.map((template, index) => ({
    challenge_date: dateStr,
    slot: index + 1,
    template_id: template.id,
  }));

  const { error } = await admin.from("daily_challenge_slots").insert(rows);
  if (error) throw error;

  await createNotificationsForAllUsers({
    type: `daily_challenges:${dateStr}`,
    message: "New daily challenges are live.",
  });

  return fetchSlotsForDate(admin, dateStr);
}

export async function getOrCreateTodaysChallenges(
  forceRotate = false
): Promise<DailyChallengeSlot[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const dateStr = todayUtcDateString();

  if (forceRotate) {
    await admin.from("daily_challenge_slots").delete().eq("challenge_date", dateStr);
  } else {
    const existing = await fetchSlotsForDate(admin, dateStr);
    if (existing.length >= 3) return existing;
  }

  const { data: templates, error: templatesError } = await admin
    .from("challenge_templates")
    .select("*")
    .eq("is_active", true);

  if (templatesError || !templates?.length) return [];

  try {
    return await insertSlotsForDate(admin, dateStr, templates as ChallengeTemplate[]);
  } catch {
    const existing = await fetchSlotsForDate(admin, dateStr);
    if (existing.length >= 3) return existing;
    return [];
  }
}

export async function forceRotateTodaysChallenges(): Promise<DailyChallengeSlot[]> {
  return getOrCreateTodaysChallenges(true);
}
