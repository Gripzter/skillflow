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

type SpResult =
  | { success: true; amount: number; balanceSp: number; lifetimeSp?: number; rankTier?: RankTier }
  | { success: false; error: string };

type UserSpData = {
  lifetimeSp: number;
  balanceSp: number;
  rankTier: RankTier;
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

export async function awardMatchSP(userId: string, won: boolean): Promise<SpResult> {
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

  const baseAmount = won ? SP_REWARDS.MATCH_WIN : SP_REWARDS.MATCH_LOSS;
  const matchType = won ? "match_win" : "match_loss";

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
  const totalAward = baseAmount + dailyBonus;

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
    amount: baseAmount,
    type: matchType,
    description: won ? "SP reward for match win" : "SP reward for match loss",
  });

  if (txError) {
    return { success: false, error: "Failed to log match SP transaction." };
  }

  if (dailyBonus > 0) {
    const { error: dailyTxError } = await supabase.from("sp_transactions").insert({
      user_id: userId,
      amount: dailyBonus,
      type: "daily_bonus",
      description: "Daily first match bonus",
    });

    if (dailyTxError) {
      return { success: false, error: "Failed to log daily match bonus transaction." };
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

  const { data, error } = await supabase
    .from("profiles")
    .select("lifetime_sp, balance_sp, rank_tier")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    lifetimeSp: Number(data.lifetime_sp ?? 0),
    balanceSp: Number(data.balance_sp ?? 0),
    rankTier: toRankTier(data.rank_tier),
  };
}
