import { createClient } from "@/lib/supabase";

export const RANK_TIER_THRESHOLDS = {
  BRONZE_MIN: 0,
  SILVER_MIN: 2000,
  GOLD_MIN: 5000,
  PLATINUM_MIN: 10000,
  DIAMOND_MIN: 20000,
} as const;

export const SP_REWARDS = {
  MATCH_WIN: 100,
  MATCH_LOSS: 25,
  STREAK_BONUS: 50,
  DAILY_FIRST_MATCH: 50,
  REFERRAL_BONUS: 200,
  SIGNUP_BONUS: 1000,
} as const;

export type RankTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

type AwardMatchSpOptions = {
  matchId?: string;
  gameType?: string;
};

type StreakBonusOptions = {
  matchId?: string;
  gameType?: string;
};

type SpResult =
  | { success: true; amount: number; balanceSp: number; lifetimeSp?: number; rankTier?: RankTier }
  | { success: false; error: string };

export type UserSpData = {
  lifetimeSp: number;
  balanceSp: number;
  rankTier: RankTier;
};

type ActiveMultiplierRow = {
  id: string;
  multiplier_id: string;
  multiplier_name: string | null;
  matches_remaining: number;
};

function getTodayWindow() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function toRankTier(value: string | null | undefined): RankTier {
  if (
    value === "bronze" ||
    value === "silver" ||
    value === "gold" ||
    value === "platinum" ||
    value === "diamond"
  ) {
    return value;
  }
  return "bronze";
}

export function calculateRankTier(lifetimeSp: number): string {
  if (lifetimeSp >= RANK_TIER_THRESHOLDS.DIAMOND_MIN) return "diamond";
  if (lifetimeSp >= RANK_TIER_THRESHOLDS.PLATINUM_MIN) return "platinum";
  if (lifetimeSp >= RANK_TIER_THRESHOLDS.GOLD_MIN) return "gold";
  if (lifetimeSp >= RANK_TIER_THRESHOLDS.SILVER_MIN) return "silver";
  return "bronze";
}

function buildMatchContextSuffix(options?: { matchId?: string; gameType?: string }): string {
  const parts: string[] = [];
  if (options?.matchId) parts.push(`match:${options.matchId}`);
  if (options?.gameType) parts.push(`game:${options.gameType}`);
  if (parts.length === 0) return "";
  return ` [${parts.join(" ")}]`;
}

function parseMultiplierValue(multiplierId: string | null | undefined): number {
  if (!multiplierId) return 1;
  const match = multiplierId.match(/mult_(\d+)x_/i);
  if (!match) return 1;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}

export async function awardMatchSP(
  userId: string,
  won: boolean,
  options?: AwardMatchSpOptions
): Promise<SpResult> {
  const supabase = createClient();
  if (!supabase) {
    return { success: false, error: "Supabase is not configured." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("lifetime_sp, balance_sp")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "Failed to load user SP profile." };
  }

  const matchContext = buildMatchContextSuffix(options);
  if (options?.matchId) {
    const { data: existingMatchReward, error: existingMatchRewardError } = await supabase
      .from("sp_transactions")
      .select("id")
      .eq("user_id", userId)
      .in("type", ["match_win", "match_loss"])
      .ilike("description", `%match:${options.matchId}%`)
      .limit(1);

    if (existingMatchRewardError) {
      return { success: false, error: "Failed to validate existing match SP reward." };
    }

    if (existingMatchReward && existingMatchReward.length > 0) {
      return {
        success: true,
        amount: 0,
        balanceSp: Number(profile.balance_sp ?? 0),
        lifetimeSp: Number(profile.lifetime_sp ?? 0),
        rankTier: calculateRankTier(Number(profile.lifetime_sp ?? 0)) as RankTier,
      };
    }
  }

  const baseAmount = won ? SP_REWARDS.MATCH_WIN : SP_REWARDS.MATCH_LOSS;
  const matchType = won ? "match_win" : "match_loss";
  let multiplier = 1;
  let activeMultiplier: ActiveMultiplierRow | null = null;

  const { data: multiplierRows } = await supabase
    .from("active_multipliers")
    .select("id, multiplier_id, multiplier_name, matches_remaining")
    .eq("user_id", userId)
    .gt("matches_remaining", 0)
    .order("created_at", { ascending: true })
    .limit(1);

  if (multiplierRows && multiplierRows.length > 0) {
    activeMultiplier = multiplierRows[0] as ActiveMultiplierRow;
    multiplier = parseMultiplierValue(activeMultiplier.multiplier_id);
  }

  const { startIso, endIso } = getTodayWindow();
  const { data: todayMatches, error: todayError } = await supabase
    .from("sp_transactions")
    .select("id")
    .eq("user_id", userId)
    .in("type", ["match_win", "match_loss"])
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .limit(1);

  if (todayError) {
    return { success: false, error: "Failed to check daily match bonus status." };
  }

  const isFirstMatchToday = !todayMatches || todayMatches.length === 0;
  const dailyBonus = isFirstMatchToday ? SP_REWARDS.DAILY_FIRST_MATCH : 0;
  const baseAwardWithMultiplier = baseAmount * multiplier;
  const totalAward = baseAwardWithMultiplier + dailyBonus;

  const currentLifetime = Number(profile.lifetime_sp ?? 0);
  const currentBalance = Number(profile.balance_sp ?? 0);
  const nextLifetime = currentLifetime + totalAward;
  const nextBalance = currentBalance + totalAward;
  const nextTier = calculateRankTier(nextLifetime) as RankTier;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      lifetime_sp: nextLifetime,
      balance_sp: nextBalance,
      rank_tier: nextTier,
    })
    .eq("id", userId);

  if (updateError) {
    return { success: false, error: "Failed to update user SP profile." };
  }

  const { error: txError } = await supabase.from("sp_transactions").insert({
    user_id: userId,
    amount: baseAwardWithMultiplier,
    type: matchType,
    description:
      (won ? "SP reward for match win" : "SP reward for match loss") +
      (multiplier > 1 ? ` (${multiplier}x multiplier)` : "") +
      matchContext,
  });

  if (txError) {
    return { success: false, error: "Failed to log match SP transaction." };
  }

  if (dailyBonus > 0) {
    const { error: dailyTxError } = await supabase.from("sp_transactions").insert({
      user_id: userId,
      amount: dailyBonus,
      type: "daily_bonus",
      description: `Daily first match bonus${matchContext}`,
    });

    if (dailyTxError) {
      return { success: false, error: "Failed to log daily match bonus transaction." };
    }
  }

  if (activeMultiplier) {
    const remaining = Number(activeMultiplier.matches_remaining ?? 0) - 1;
    if (remaining <= 0) {
      const { error: deleteMultiplierError } = await supabase
        .from("active_multipliers")
        .delete()
        .eq("id", activeMultiplier.id)
        .eq("user_id", userId);
      if (deleteMultiplierError) {
        return { success: false, error: "Failed to consume active multiplier." };
      }
    } else {
      const { error: decrementMultiplierError } = await supabase
        .from("active_multipliers")
        .update({ matches_remaining: remaining })
        .eq("id", activeMultiplier.id)
        .eq("user_id", userId);
      if (decrementMultiplierError) {
        return { success: false, error: "Failed to update active multiplier progress." };
      }
    }
  }

  return {
    success: true,
    amount: totalAward,
    balanceSp: nextBalance,
    lifetimeSp: nextLifetime,
    rankTier: nextTier,
  };
}

export async function awardStreakBonusIfEligible(
  userId: string,
  options?: StreakBonusOptions
): Promise<SpResult> {
  const supabase = createClient();
  if (!supabase) {
    return { success: false, error: "Supabase is not configured." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("lifetime_sp, balance_sp")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "Failed to load user SP profile." };
  }

  if (options?.matchId) {
    const { data: existingStreakBonus, error: existingStreakBonusError } = await supabase
      .from("sp_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "streak_bonus")
      .ilike("description", `%match:${options.matchId}%`)
      .limit(1);

    if (existingStreakBonusError) {
      return { success: false, error: "Failed to validate existing streak bonus." };
    }

    if (existingStreakBonus && existingStreakBonus.length > 0) {
      return {
        success: true,
        amount: 0,
        balanceSp: Number(profile.balance_sp ?? 0),
        lifetimeSp: Number(profile.lifetime_sp ?? 0),
        rankTier: calculateRankTier(Number(profile.lifetime_sp ?? 0)) as RankTier,
      };
    }
  }

  const { data: recentOutcomes, error: outcomesError } = await supabase
    .from("sp_transactions")
    .select("type")
    .eq("user_id", userId)
    .in("type", ["match_win", "match_loss"])
    .order("created_at", { ascending: false })
    .limit(3);

  if (outcomesError) {
    return { success: false, error: "Failed to check recent match outcomes for streak bonus." };
  }

  const streakEligible =
    !!recentOutcomes &&
    recentOutcomes.length === 3 &&
    recentOutcomes.every((row) => row.type === "match_win");

  if (!streakEligible) {
    return {
      success: true,
      amount: 0,
      balanceSp: Number(profile.balance_sp ?? 0),
      lifetimeSp: Number(profile.lifetime_sp ?? 0),
      rankTier: calculateRankTier(Number(profile.lifetime_sp ?? 0)) as RankTier,
    };
  }

  const currentLifetime = Number(profile.lifetime_sp ?? 0);
  const currentBalance = Number(profile.balance_sp ?? 0);
  const nextLifetime = currentLifetime + SP_REWARDS.STREAK_BONUS;
  const nextBalance = currentBalance + SP_REWARDS.STREAK_BONUS;
  const nextTier = calculateRankTier(nextLifetime) as RankTier;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      lifetime_sp: nextLifetime,
      balance_sp: nextBalance,
      rank_tier: nextTier,
    })
    .eq("id", userId);

  if (updateError) {
    return { success: false, error: "Failed to update profile for streak bonus." };
  }

  const matchContext = buildMatchContextSuffix(options);
  const { error: txError } = await supabase.from("sp_transactions").insert({
    user_id: userId,
    amount: SP_REWARDS.STREAK_BONUS,
    type: "streak_bonus",
    description: `3-win streak bonus${matchContext}`,
  });

  if (txError) {
    return { success: false, error: "Failed to log streak bonus transaction." };
  }

  return {
    success: true,
    amount: SP_REWARDS.STREAK_BONUS,
    balanceSp: nextBalance,
    lifetimeSp: nextLifetime,
    rankTier: nextTier,
  };
}

export async function spendSP(
  userId: string,
  amount: number,
  type: string,
  description: string
): Promise<SpResult> {
  if (amount <= 0) {
    return { success: false, error: "Amount must be greater than zero." };
  }

  const supabase = createClient();
  if (!supabase) {
    return { success: false, error: "Supabase is not configured." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("balance_sp")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "Failed to load user SP balance." };
  }

  const currentBalance = Number(profile.balance_sp ?? 0);
  if (currentBalance < amount) {
    return { success: false, error: "Insufficient SkillPoints balance." };
  }

  const nextBalance = currentBalance - amount;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ balance_sp: nextBalance })
    .eq("id", userId);

  if (updateError) {
    return { success: false, error: "Failed to update SkillPoints balance." };
  }

  const { error: txError } = await supabase.from("sp_transactions").insert({
    user_id: userId,
    amount: -amount,
    type,
    description,
  });

  if (txError) {
    return { success: false, error: "Failed to log SP spend transaction." };
  }

  return {
    success: true,
    amount: -amount,
    balanceSp: nextBalance,
  };
}

export async function getUserSPData(userId: string): Promise<UserSpData | null> {
  const supabase = createClient();
  if (!supabase) return null;

  let resolvedUserId = userId;
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) {
      // eslint-disable-next-line no-console
      console.error("[SP] Failed to resolve authenticated user for SP lookup", {
        providedUserId: userId,
        error: authError.message,
      });
    } else if (user?.id) {
      if (user.id !== userId) {
        // eslint-disable-next-line no-console
        console.warn("[SP] Using authenticated user ID for SP lookup", {
          providedUserId: userId,
          authenticatedUserId: user.id,
        });
      }
      resolvedUserId = user.id;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[SP] Unexpected error resolving authenticated user for SP lookup", {
      providedUserId: userId,
      error,
    });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("lifetime_sp, balance_sp, rank_tier")
    .eq("id", resolvedUserId)
    .single();

  if (error || !data) return null;

  return {
    lifetimeSp: Number(data.lifetime_sp ?? 0),
    balanceSp: Number(data.balance_sp ?? 0),
    rankTier: toRankTier(data.rank_tier),
  };
}
