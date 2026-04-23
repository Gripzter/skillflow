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

type DailyChallengeDbRow = {
  id: string;
  user_id: string;
  type?: ChallengeType;
  challenge_type?: ChallengeType;
  description?: string;
  challenge_description?: string;
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

function isChallengeActive(expiresAt: string, now = new Date()): boolean {
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return false;
  return expiresAtMs > now.getTime();
}

function normalizeDailyChallengeRow(row: DailyChallengeDbRow): DailyChallengeRow | null {
  const resolvedType = row.type ?? row.challenge_type;
  const resolvedDescription = row.description ?? row.challenge_description;
  if (!resolvedType || !resolvedDescription) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    type: resolvedType,
    description: resolvedDescription,
    target: Number(row.target ?? 0),
    progress: Number(row.progress ?? 0),
    reward_sp: Number(row.reward_sp ?? 0),
    completed: Boolean(row.completed),
    claimed: Boolean(row.claimed),
    expires_at: row.expires_at,
    created_at: row.created_at,
  };
}

export async function resolveSessionUserId(
  userId: string
): Promise<{ resolvedUserId: string; supabase: ReturnType<typeof createClient> }> {
  const supabase = createClient();
  if (!supabase) {
    return { resolvedUserId: userId, supabase };
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[DailyChallenges] Failed to resolve authenticated user", {
        providedUserId: userId,
        error: error.message,
      });
      return { resolvedUserId: userId, supabase };
    }
    if (user?.id && user.id !== userId) {
      // eslint-disable-next-line no-console
      console.warn("[DailyChallenges] Using authenticated user ID instead of provided user ID", {
        providedUserId: userId,
        authenticatedUserId: user.id,
      });
    }
    return { resolvedUserId: user?.id ?? userId, supabase };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[DailyChallenges] Unexpected error resolving authenticated user", {
      providedUserId: userId,
      error,
    });
    return { resolvedUserId: userId, supabase };
  }
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
  const { resolvedUserId, supabase } = await resolveSessionUserId(userId);
  if (!supabase) {
    // eslint-disable-next-line no-console
    console.error("[DailyChallenges] Supabase client unavailable");
    return [];
  }

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const { data: existing, error: existingError } = await supabase
      .from("daily_challenges")
      .select("*")
      .eq("user_id", resolvedUserId)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: true });
    if (existingError) {
      // eslint-disable-next-line no-console
      console.error("[DailyChallenges] Failed to fetch active challenges", {
        userId: resolvedUserId,
        error: existingError.message,
      });
    }

    const activeChallenges = ((existing ?? []) as DailyChallengeDbRow[])
      .map(normalizeDailyChallengeRow)
      .filter((challenge): challenge is DailyChallengeRow => Boolean(challenge))
      .filter((challenge) => isChallengeActive(String(challenge.expires_at), now));
    if (activeChallenges.length > 0) {
      // eslint-disable-next-line no-console
      console.log("[DailyChallenges] Using existing active challenges", {
        userId: resolvedUserId,
        count: activeChallenges.length,
      });
      return activeChallenges;
    }

    const candidateExpiry = new Date(getUtcMidnightTonightIso());
    const expiresAtDate =
      candidateExpiry.getTime() <= now.getTime()
        ? new Date(candidateExpiry.getTime() + 24 * 60 * 60 * 1000)
        : candidateExpiry;
    const expiresAt = expiresAtDate.toISOString();
    const templates = pickRandomTemplates(3);
    const rowsToInsert = templates.map((template) => ({
      user_id: resolvedUserId,
      challenge_type: template.type,
      challenge_description: template.description,
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
      userId: resolvedUserId,
      challengeTypes: templates.map((t) => t.type),
      expiresAt,
    });

    let { error: insertError } = await supabase.from("daily_challenges").insert(rowsToInsert);
    if (insertError) {
      // Backward-compatible insert for schemas still using `type`.
      const legacyRowsToInsert = templates.map((template) => ({
        user_id: resolvedUserId,
        type: template.type,
        description: template.description,
        target: template.target,
        progress: 0,
        reward_sp: template.rewardSp,
        completed: false,
        claimed: false,
        expires_at: expiresAt,
      }));
      const { error: legacyInsertError } = await supabase.from("daily_challenges").insert(legacyRowsToInsert);
      insertError = legacyInsertError;
    }

    if (insertError) {
      // eslint-disable-next-line no-console
      console.error("[DailyChallenges] Failed to insert generated challenges", {
        userId: resolvedUserId,
        error: insertError.message,
        payload: rowsToInsert,
      });
      return [];
    }

    const { data: insertedRows, error: insertedRowsError } = await supabase
      .from("daily_challenges")
      .select("*")
      .eq("user_id", resolvedUserId)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: true });
    if (insertedRowsError) {
      // eslint-disable-next-line no-console
      console.error("[DailyChallenges] Challenges inserted but failed to re-fetch active challenges", {
        userId: resolvedUserId,
        error: insertedRowsError.message,
      });
      return [];
    }

    return ((insertedRows ?? []) as DailyChallengeDbRow[])
      .map(normalizeDailyChallengeRow)
      .filter((challenge): challenge is DailyChallengeRow => Boolean(challenge));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[DailyChallenges] Unexpected failure while loading daily challenges", {
      userId: resolvedUserId,
      error,
    });
    return [];
  }
}

export async function updateChallengeProgress(
  userId: string,
  eventType: string,
  gameType?: string
): Promise<DailyChallengeRow[]> {
  const { resolvedUserId, supabase } = await resolveSessionUserId(userId);
  if (!supabase) return [];
  try {
    const nowIso = new Date().toISOString();
    const { data: active, error: activeError } = await supabase
      .from("daily_challenges")
      .select("*")
      .eq("user_id", resolvedUserId)
      .eq("claimed", false)
      .eq("completed", false)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: true });

    if (activeError) {
      // eslint-disable-next-line no-console
      console.error("[DailyChallenges] Failed to fetch challenges for progress update", {
        userId: resolvedUserId,
        eventType,
        gameType,
        error: activeError.message,
      });
      return [];
    }

    const activeChallenges = ((active ?? []) as DailyChallengeDbRow[])
      .map(normalizeDailyChallengeRow)
      .filter((challenge): challenge is DailyChallengeRow => Boolean(challenge));
    if (activeChallenges.length === 0) return [];

    const isMatchWinEvent = eventType === "match_win";
    const isMatchCompleteEvent = eventType === "match_complete" || eventType === "match_win";
    const isMatchPlayEvent =
      eventType === "match_start" || eventType === "match_complete" || eventType === "match_win";

    const distinctGamesToday = isMatchPlayEvent ? await getDistinctGamesPlayedToday(resolvedUserId) : [];
    const winStreakToday =
      eventType === "match_win" || eventType === "match_complete"
        ? await getCurrentWinStreakToday(resolvedUserId)
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
      const { data: updated, error: updateError } = await supabase
        .from("daily_challenges")
        .update({
          progress: nextProgress,
          completed,
        })
        .eq("id", challenge.id)
        .eq("user_id", resolvedUserId)
        .select("*")
        .single();
      if (updateError) {
        // eslint-disable-next-line no-console
        console.error("[DailyChallenges] Failed to update challenge progress", {
          userId: resolvedUserId,
          challengeId: challenge.id,
          eventType,
          error: updateError.message,
        });
        continue;
      }

      if (updated) {
        const normalized = normalizeDailyChallengeRow(updated as DailyChallengeDbRow);
        if (normalized) {
          updates.push(normalized);
        }
      }
    }

    return updates;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[DailyChallenges] Unexpected error while updating challenge progress", {
      userId: resolvedUserId,
      eventType,
      gameType,
      error,
    });
    return [];
  }
}

export async function claimChallengeReward(
  userId: string,
  challengeId: string
): Promise<{ success: true; rewardSp: number } | { success: false; error: string }> {
  const { resolvedUserId, supabase } = await resolveSessionUserId(userId);
  if (!supabase) return { success: false, error: "Supabase is not configured." };
  try {
    const now = new Date();
    const { data: challenge, error: challengeError } = await supabase
      .from("daily_challenges")
      .select("*")
      .eq("id", challengeId)
      .eq("user_id", resolvedUserId)
      .single();

    const normalizedChallenge = challenge
      ? normalizeDailyChallengeRow(challenge as DailyChallengeDbRow)
      : null;

    if (challengeError || !normalizedChallenge) {
      if (challengeError) {
        // eslint-disable-next-line no-console
        console.error("[DailyChallenges] Failed to load challenge for reward claim", {
          userId: resolvedUserId,
          challengeId,
          error: challengeError.message,
        });
      }
      return { success: false, error: "Challenge not found." };
    }

    if (normalizedChallenge.claimed) {
      return { success: false, error: "Challenge reward already claimed." };
    }

    if (!normalizedChallenge.completed) {
      return { success: false, error: "Challenge is not complete yet." };
    }

    if (!isChallengeActive(String(normalizedChallenge.expires_at), now)) {
      return { success: false, error: "Challenge has expired." };
    }

    const rewardSp = Number(normalizedChallenge.reward_sp ?? 0);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("lifetime_sp, balance_sp")
      .eq("id", resolvedUserId)
      .single();

    if (profileError || !profile) {
      if (profileError) {
        // eslint-disable-next-line no-console
        console.error("[DailyChallenges] Failed to load profile for challenge claim", {
          userId: resolvedUserId,
          challengeId,
          error: profileError.message,
        });
      }
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
      .eq("id", resolvedUserId);

    if (updateProfileError) {
      // eslint-disable-next-line no-console
      console.error("[DailyChallenges] Failed to apply challenge reward to profile", {
        userId: resolvedUserId,
        challengeId,
        rewardSp,
        error: updateProfileError.message,
      });
      return { success: false, error: "Failed to apply challenge reward." };
    }

    const { error: txError } = await supabase.from("sp_transactions").insert({
      user_id: resolvedUserId,
      amount: rewardSp,
      type: "challenge_reward",
      description: `Daily challenge reward: ${normalizedChallenge.description}`,
    });

    if (txError) {
      // eslint-disable-next-line no-console
      console.error("[DailyChallenges] Failed to insert challenge reward transaction", {
        userId: resolvedUserId,
        challengeId,
        rewardSp,
        error: txError.message,
      });
      return { success: false, error: "Failed to log challenge reward transaction." };
    }

    const { error: claimError } = await supabase
      .from("daily_challenges")
      .update({ claimed: true })
      .eq("id", challengeId)
      .eq("user_id", resolvedUserId);

    if (claimError) {
      // eslint-disable-next-line no-console
      console.error("[DailyChallenges] Failed to mark challenge as claimed", {
        userId: resolvedUserId,
        challengeId,
        error: claimError.message,
      });
      return { success: false, error: "Failed to mark challenge reward as claimed." };
    }

    return { success: true, rewardSp };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[DailyChallenges] Unexpected error while claiming challenge reward", {
      userId: resolvedUserId,
      challengeId,
      error,
    });
    return { success: false, error: "Unexpected error while claiming challenge reward." };
  }
}
