import { createClient } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  challengeGameMatches,
  type ChallengeGame,
  type ChallengeType,
} from "@/lib/challengeGames";
import {
  getOrCreateTodaysChallenges,
  type DailyChallengeSlot,
} from "@/lib/challengeRotation";

export type ChallengeEventType = "match_played" | "match_won";

export type PlayerDailyChallenge = {
  slotId: string;
  slot: number;
  title: string;
  description: string | null;
  game: ChallengeGame;
  challengeType: ChallengeType;
  targetValue: number;
  rewardSk: number;
  difficulty: string;
  progress: number;
  completed: boolean;
  rewardClaimed: boolean;
  progressId: string | null;
};

function eventMatchesChallengeType(
  challengeType: ChallengeType,
  eventType: ChallengeEventType
): boolean {
  if (challengeType === "play_matches") return eventType === "match_played";
  if (challengeType === "win_matches") return eventType === "match_won";
  return false;
}

function slotToView(
  slot: DailyChallengeSlot,
  progress: {
    id: string;
    progress: number;
    completed: boolean;
    reward_claimed: boolean;
  } | null
): PlayerDailyChallenge {
  return {
    slotId: slot.id,
    slot: slot.slot,
    title: slot.template.title,
    description: slot.template.description,
    game: slot.template.game as ChallengeGame,
    challengeType: slot.template.challenge_type as ChallengeType,
    targetValue: slot.template.target_value,
    rewardSk: slot.template.reward_sk,
    difficulty: slot.template.difficulty,
    progress: progress?.progress ?? 0,
    completed: progress?.completed ?? false,
    rewardClaimed: progress?.reward_claimed ?? false,
    progressId: progress?.id ?? null,
  };
}

export async function getPlayerDailyChallenges(userId: string): Promise<PlayerDailyChallenge[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resolvedUserId = user?.id ?? userId;
  if (!resolvedUserId) return [];

  const dateStr = new Date().toISOString().slice(0, 10);
  const { data: slots, error: slotsError } = await supabase
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
        is_active,
        difficulty,
        created_at
      )
    `
    )
    .eq("challenge_date", dateStr)
    .order("slot", { ascending: true });

  if (slotsError || !slots?.length) return [];

  const slotIds = slots.map((s) => s.id as string);
  const { data: progressRows } = await supabase
    .from("player_challenge_progress")
    .select("*")
    .eq("user_id", resolvedUserId)
    .in("slot_id", slotIds);

  const progressBySlot = new Map(
    (progressRows ?? []).map((p) => [p.slot_id as string, p])
  );

  return slots
    .map((row) => {
      const template = Array.isArray(row.template) ? row.template[0] : row.template;
      if (!template) return null;
      const slot: DailyChallengeSlot = {
        id: row.id as string,
        challenge_date: row.challenge_date as string,
        slot: row.slot as number,
        template_id: row.template_id as string,
        template: template as DailyChallengeSlot["template"],
      };
      const progress = progressBySlot.get(slot.id);
      return slotToView(
        slot,
        progress
          ? {
              id: progress.id as string,
              progress: Number(progress.progress ?? 0),
              completed: Boolean(progress.completed),
              reward_claimed: Boolean(progress.reward_claimed),
            }
          : null
      );
    })
    .filter((c): c is PlayerDailyChallenge => Boolean(c));
}

export async function incrementChallengeProgress(
  userId: string,
  gameId: ChallengeGame | null,
  eventType: ChallengeEventType
): Promise<PlayerDailyChallenge[]> {
  if (!gameId) return [];

  const admin = createAdminClient();
  if (!admin) return [];

  const slots = await getOrCreateTodaysChallenges(false);
  if (!slots.length) return [];

  const applicable = slots.filter((slot) => {
    const type = slot.template.challenge_type as ChallengeType;
    if (!eventMatchesChallengeType(type, eventType)) return false;
    return challengeGameMatches(slot.template.game as ChallengeGame, gameId);
  });

  if (!applicable.length) return [];

  for (const slot of applicable) {
    const { data: existing } = await admin
      .from("player_challenge_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("slot_id", slot.id)
      .maybeSingle();

    if (existing?.completed) continue;

    const nextProgress = Number(existing?.progress ?? 0) + 1;
    const completed = nextProgress >= slot.template.target_value;

    if (existing) {
      await admin
        .from("player_challenge_progress")
        .update({
          progress: nextProgress,
          completed,
          completed_at: completed ? new Date().toISOString() : existing.completed_at,
        })
        .eq("id", existing.id);
    } else {
      await admin.from("player_challenge_progress").insert({
        user_id: userId,
        slot_id: slot.id,
        progress: nextProgress,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      });
    }
  }

  return getPlayerDailyChallenges(userId);
}

export async function notifyChallengeProgressFromClient(
  userId: string,
  gameType: string,
  won: boolean
): Promise<void> {
  try {
    const supabase = createClient();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    }

    const payload = { userId, gameType, eventType: "match_played" as const };
    void fetch("/api/challenges/increment", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});

    if (won) {
      void fetch("/api/challenges/increment", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...payload, eventType: "match_won" }),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // fire-and-forget
  }
}

export async function claimChallengeReward(
  userId: string,
  slotId: string
): Promise<
  | { success: true; rewardSk: number; newBalance: number }
  | { success: false; error: string }
> {
  const supabase = createClient();
  if (!supabase) return { success: false, error: "Supabase is not configured." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resolvedUserId = user?.id ?? userId;
  if (!resolvedUserId) return { success: false, error: "Not authenticated." };

  const { data, error } = await supabase.rpc("claim_challenge_reward", {
    p_slot_id: slotId,
  });

  if (error) {
    const msg = error.message.includes("ALREADY_CLAIMED")
      ? "Reward already claimed."
      : error.message.includes("CHALLENGE_NOT_COMPLETED")
        ? "Challenge is not complete yet."
        : error.message;
    return { success: false, error: msg };
  }

  const payload = data as { reward_sk?: number; new_balance?: number } | null;
  return {
    success: true,
    rewardSk: Number(payload?.reward_sk ?? 0),
    newBalance: Number(payload?.new_balance ?? 0),
  };
}
