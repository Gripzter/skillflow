/**
 * Responsible gaming: deposit limits, cool-off, self-exclusion.
 * Used server-side (API routes, webhook) and client-side (settings, lobby checks).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResponsibleGamingRow {
  id?: string;
  user_id: string;
  daily_deposit_limit: number | null;
  weekly_deposit_limit: number | null;
  monthly_deposit_limit: number | null;
  daily_deposited: number;
  weekly_deposited: number;
  monthly_deposited: number;
  daily_reset_at: string;
  weekly_reset_at: string;
  monthly_reset_at: string;
  self_excluded: boolean;
  self_exclusion_until: string | null;
  self_exclusion_type: string | null;
  cool_off_until: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CheckResult {
  allowed: boolean;
  reason?: string;
}

/** Apply any pending limit changes that have passed their effective_at. Call when loading RG settings or before limit checks. */
export async function applyPendingLimitChanges(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { data: pending } = await supabase
    .from("pending_limit_changes")
    .select("limit_type, new_value, effective_at")
    .eq("user_id", userId)
    .lte("effective_at", now);

  if (!pending?.length) return;

  const { data: rg } = await supabase
    .from("responsible_gaming")
    .select("id")
    .eq("user_id", userId)
    .single();

  const updates: Partial<ResponsibleGamingRow> = { updated_at: now };
  for (const p of pending) {
    const col = `${p.limit_type}_deposit_limit` as keyof ResponsibleGamingRow;
    (updates as Record<string, unknown>)[col] = p.new_value;
  }

  if (rg) {
    await supabase.from("responsible_gaming").update(updates).eq("user_id", userId);
  } else {
    await supabase.from("responsible_gaming").insert({
      user_id: userId,
      ...updates,
    });
  }
  await supabase.from("pending_limit_changes").delete().eq("user_id", userId);
}

export async function checkDepositAllowed(
  supabase: SupabaseClient,
  userId: string,
  depositAmount: number
): Promise<CheckResult> {
  await applyPendingLimitChanges(supabase, userId);

  const { data: rg } = await supabase
    .from("responsible_gaming")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!rg) return { allowed: true };

  if (rg.self_excluded) {
    const until = rg.self_exclusion_until;
    if (!until || new Date(until) > new Date()) {
      return { allowed: false, reason: "Your account is self-excluded." };
    }
  }

  if (rg.cool_off_until && new Date(rg.cool_off_until) > new Date()) {
    const remaining = Math.ceil(
      (new Date(rg.cool_off_until).getTime() - Date.now()) / (1000 * 60 * 60)
    );
    return {
      allowed: false,
      reason: `You are in a cool-off period. ${remaining} hours remaining.`,
    };
  }

  const now = new Date();
  const updates: Record<string, unknown> = { updated_at: now.toISOString() };
  let dailyDeposited = Number(rg.daily_deposited ?? 0);
  let weeklyDeposited = Number(rg.weekly_deposited ?? 0);
  let monthlyDeposited = Number(rg.monthly_deposited ?? 0);

  const dailyReset = new Date(rg.daily_reset_at);
  if (dailyReset.getDate() !== now.getDate() || dailyReset.getMonth() !== now.getMonth() || dailyReset.getFullYear() !== now.getFullYear()) {
    updates.daily_deposited = 0;
    updates.daily_reset_at = now.toISOString();
    dailyDeposited = 0;
  }
  const weeklyReset = new Date(rg.weekly_reset_at);
  if (now.getTime() - weeklyReset.getTime() > 7 * 24 * 60 * 60 * 1000) {
    updates.weekly_deposited = 0;
    updates.weekly_reset_at = now.toISOString();
    weeklyDeposited = 0;
  }
  const monthlyReset = new Date(rg.monthly_reset_at);
  if (monthlyReset.getMonth() !== now.getMonth() || monthlyReset.getFullYear() !== now.getFullYear()) {
    updates.monthly_deposited = 0;
    updates.monthly_reset_at = now.toISOString();
    monthlyDeposited = 0;
  }

  if (Object.keys(updates).length > 1) {
    await supabase.from("responsible_gaming").update(updates).eq("user_id", userId);
  }

  if (rg.daily_deposit_limit != null) {
    const limit = Number(rg.daily_deposit_limit);
    if (dailyDeposited + depositAmount > limit) {
      return {
        allowed: false,
        reason: `Daily deposit limit reached. Limit: $${limit}. Used today: $${dailyDeposited}.`,
      };
    }
  }
  if (rg.weekly_deposit_limit != null) {
    const limit = Number(rg.weekly_deposit_limit);
    if (weeklyDeposited + depositAmount > limit) {
      return {
        allowed: false,
        reason: `Weekly deposit limit reached. Limit: $${limit}. Used this week: $${weeklyDeposited}.`,
      };
    }
  }
  if (rg.monthly_deposit_limit != null) {
    const limit = Number(rg.monthly_deposit_limit);
    if (monthlyDeposited + depositAmount > limit) {
      return {
        allowed: false,
        reason: `Monthly deposit limit reached. Limit: $${limit}. Used this month: $${monthlyDeposited}.`,
      };
    }
  }

  return { allowed: true };
}

export async function recordDeposit(
  supabase: SupabaseClient,
  userId: string,
  amount: number
): Promise<void> {
  const { data: rg } = await supabase
    .from("responsible_gaming")
    .select("daily_deposited, weekly_deposited, monthly_deposited")
    .eq("user_id", userId)
    .single();

  if (rg) {
    await supabase
      .from("responsible_gaming")
      .update({
        daily_deposited: Number(rg.daily_deposited ?? 0) + amount,
        weekly_deposited: Number(rg.weekly_deposited ?? 0) + amount,
        monthly_deposited: Number(rg.monthly_deposited ?? 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }
}

export async function checkCanPlay(
  supabase: SupabaseClient,
  userId: string
): Promise<CheckResult> {
  const { data: rg } = await supabase
    .from("responsible_gaming")
    .select("self_excluded, self_exclusion_until, cool_off_until")
    .eq("user_id", userId)
    .single();

  if (!rg) return { allowed: true };

  if (rg.self_excluded) {
    if (!rg.self_exclusion_until || new Date(rg.self_exclusion_until) > new Date()) {
      return { allowed: false, reason: "Your account is self-excluded from real money play." };
    }
  }

  if (rg.cool_off_until && new Date(rg.cool_off_until) > new Date()) {
    return {
      allowed: false,
      reason: "You are in a cool-off period. Practice mode is still available.",
    };
  }

  return { allowed: true };
}
