import { createClient } from "@/lib/supabase";

export type ChallengeType =
  | "win_matches"
  | "complete_matches"
  | "try_new_game"
  | "win_streak"
  | "play_variety";

export type DailyChallengeTemplate = {
  type: ChallengeType;
  description: string;
  target: number;
  rewardSp: number;
};

export type DailyChallengeRow = {
  id: string;
  user_id: string;
  type: ChallengeType;
  description: string;
  target: number;
  progress: number;
  reward_sp: number;
  completed: boolean;
  claimed: boolean;
  expires_at: string;
  created_at: string;
};

export const DAILY_CHALLENGE_TEMPLATES: DailyChallengeTemplate[] = [
  { type: "win_matches", description: "Win 3 matches", target: 3, rewardSp: 150 },
  { type: "complete_matches", description: "Complete 5 matches", target: 5, rewardSp: 100 },
  {
    type: "try_new_game",
    description: "Play a game you haven't played today",
    target: 1,
    rewardSp: 100,
  },
  { type: "win_streak", description: "Win 2 matches in a row", target: 2, rewardSp: 200 },
  { type: "play_variety", description: "Play 3 different games", target: 3, rewardSp: 150 },
];

function getUtcDayWindow(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function getUtcMidnightTonightIso() {
  return getUtcDayWindow().endIso;
}

function pickRandomTemplates(count: number): DailyChallengeTemplate[] {
  const shuffled = [...DAILY_CHALLENGE_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(0, Math.min(count, shuffled.length)));
}

async function getTodayMatchesForUser(userId: string) {
  const supabase = createClient();
  if (!supabase) return [];

  const { startIso, endIso } = getUtcDayWindow();
  const { data } = await supabase
    .from("matches")
    .select("id, game_type, result, player1_id, player2_id, created_at")
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: false });

  return (
    data?.map((row) => ({
      id: row.id as string,
      gameType: String(row.game_type ?? ""),
      result: String(row.result ?? ""),
      player1Id: row.player1_id as string | null,
      player2Id: row.player2_id as string | null,
      createdAt: String(row.created_at ?? ""),
    })) ?? []
  );
}

async function getDistinctGamesPlayedToday(userId: string): Promise<string[]> {
  const matches = await getTodayMatchesForUser(userId);
  return Array.from(new Set(matches.map((m) => m.gameType).filter(Boolean)));
}

async function getCurrentWinStreakToday(userId: string): Promise<number> {
  const matches = await getTodayMatchesForUser(userId);
  let streak = 0;

  for (const match of matches) {
    const won =
      (match.result === "player1_win" && match.player1Id === userId) ||
      (match.result === "player2_win" && match.player2Id === userId);

    if (won) {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

export async function getDailyChallenges(userId: string): Promise<DailyChallengeRow[]> {
  const supabase = createClient();
  if (!supabase) {
    // eslint-disable-next-line no-console
    console.error("[DailyChallenges] Supabase client unavailable");
    return [];
  }

  const nowIso = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("daily_challenges")
    .select("*")
    .eq("user_id", userId)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: true });
  if (existingError) {
    // eslint-disable-next-line no-console
    console.error("[DailyChallenges] Failed to fetch active challenges", {
      userId,
      error: existingError.message,
    });
  }

  const activeChallenges = (existing ?? []) as DailyChallengeRow[];
  if (activeChallenges.length > 0) {
    // eslint-disable-next-line no-console
    console.log("[DailyChallenges] Using existing active challenges", {
      userId,
      count: activeChallenges.length,
    });
    return activeChallenges;
  }

  const expiresAt = getUtcMidnightTonightIso();
  const templates = pickRandomTemplates(3);
  const rowsToInsert = templates.map((template) => ({
    user_id: userId,
    type: template.type,
    description: template.description,
    target: template.target,
    progress: 0,
    reward_sp: template.rewardSp,
    completed: false,
    claimed: false,
    expires_at: expiresAt,
  }));

  // eslint-disable-next-line no-console
  console.log("[DailyChallenges] Generating new daily challenges", {
    userId,
    challengeTypes: templates.map((t) => t.type),
    expiresAt,
  });

  const { data: inserted, error: insertError } = await supabase
    .from("daily_challenges")
    .insert(rowsToInsert)
    .select("*");
  if (insertError) {
    // eslint-disable-next-line no-console
    console.error("[DailyChallenges] Failed to insert generated challenges", {
      userId,
      error: insertError.message,
      payload: rowsToInsert,
    });
  }

  return (inserted ?? []) as DailyChallengeRow[];
}

export async function updateChallengeProgress(
  userId: string,
  eventType: string,
  gameType?: string
): Promise<DailyChallengeRow[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const nowIso = new Date().toISOString();
  const { data: active } = await supabase
    .from("daily_challenges")
    .select("*")
    .eq("user_id", userId)
    .eq("claimed", false)
    .eq("completed", false)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: true });

  const activeChallenges = (active ?? []) as DailyChallengeRow[];
  if (activeChallenges.length === 0) return [];

  const isMatchWinEvent = eventType === "match_win";
  const isMatchCompleteEvent = eventType === "match_complete" || eventType === "match_win";
  const isMatchPlayEvent =
    eventType === "match_start" || eventType === "match_complete" || eventType === "match_win";

  const distinctGamesToday = isMatchPlayEvent ? await getDistinctGamesPlayedToday(userId) : [];
  const winStreakToday =
    eventType === "match_win" || eventType === "match_complete"
      ? await getCurrentWinStreakToday(userId)
      : 0;

  const updates: DailyChallengeRow[] = [];

  for (const challenge of activeChallenges) {
    let nextProgress = Number(challenge.progress ?? 0);
    let touched = false;

    if (challenge.type === "win_matches" && isMatchWinEvent) {
      nextProgress = Math.min(challenge.target, nextProgress + 1);
      touched = true;
    }

    if (challenge.type === "complete_matches" && isMatchCompleteEvent) {
      nextProgress = Math.min(challenge.target, nextProgress + 1);
      touched = true;
    }

    if (challenge.type === "win_streak" && (eventType === "match_win" || eventType === "match_complete")) {
      nextProgress = Math.min(challenge.target, winStreakToday);
      touched = true;
    }

    if (challenge.type === "try_new_game" && isMatchPlayEvent && gameType) {
      const hasPlayedThisGameToday = distinctGamesToday.includes(gameType);
      nextProgress = hasPlayedThisGameToday ? 1 : nextProgress;
      touched = true;
    }

    if (challenge.type === "play_variety" && isMatchPlayEvent) {
      nextProgress = Math.min(challenge.target, distinctGamesToday.length);
      touched = true;
    }

    if (!touched) continue;

    const completed = nextProgress >= challenge.target;
    const { data: updated } = await supabase
      .from("daily_challenges")
      .update({
        progress: nextProgress,
        completed,
      })
      .eq("id", challenge.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updated) {
      updates.push(updated as DailyChallengeRow);
    }
  }

  return updates;
}

export async function claimChallengeReward(
  userId: string,
  challengeId: string
): Promise<{ success: true; rewardSp: number } | { success: false; error: string }> {
  const supabase = createClient();
  if (!supabase) return { success: false, error: "Supabase is not configured." };

  const nowIso = new Date().toISOString();
  const { data: challenge, error: challengeError } = await supabase
    .from("daily_challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("user_id", userId)
    .single();

  if (challengeError || !challenge) {
    return { success: false, error: "Challenge not found." };
  }

  if (challenge.claimed) {
    return { success: false, error: "Challenge reward already claimed." };
  }

  if (!challenge.completed) {
    return { success: false, error: "Challenge is not complete yet." };
  }

  if (String(challenge.expires_at) <= nowIso) {
    return { success: false, error: "Challenge has expired." };
  }

  const rewardSp = Number(challenge.reward_sp ?? 0);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("lifetime_sp, balance_sp")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "Failed to load profile." };
  }

  const currentLifetime = Number(profile.lifetime_sp ?? 0);
  const currentBalance = Number(profile.balance_sp ?? 0);
  const nextLifetime = currentLifetime + rewardSp;
  const nextBalance = currentBalance + rewardSp;

  const { error: updateProfileError } = await supabase
    .from("profiles")
    .update({
      lifetime_sp: nextLifetime,
      balance_sp: nextBalance,
    })
    .eq("id", userId);

  if (updateProfileError) {
    return { success: false, error: "Failed to apply challenge reward." };
  }

  const { error: txError } = await supabase.from("sp_transactions").insert({
    user_id: userId,
    amount: rewardSp,
    type: "challenge_reward",
    description: `Daily challenge reward: ${challenge.description}`,
  });

  if (txError) {
    return { success: false, error: "Failed to log challenge reward transaction." };
  }

  const { error: claimError } = await supabase
    .from("daily_challenges")
    .update({ claimed: true })
    .eq("id", challengeId)
    .eq("user_id", userId);

  if (claimError) {
    return { success: false, error: "Failed to mark challenge reward as claimed." };
  }

  return { success: true, rewardSp };
}
