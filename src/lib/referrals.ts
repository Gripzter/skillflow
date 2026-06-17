/**
 * Referral system: invite friends, both get Skillies on the first qualifying deposit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const BONUS_AMOUNT = 50;
const MIN_DEPOSIT_FOR_BONUS = 5;
const MAX_REFERRAL_BONUSES_PER_USER = 50;

export function generateReferralCode(username: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const cleanName = username
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 15);
  return `${cleanName}_${suffix}`;
}

/** Ensure user has a unique referral code; if not, generate and save. Returns the code. */
export async function ensureReferralCode(
  supabase: SupabaseClient,
  userId: string,
  username: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();

  if (profile?.referral_code) return profile.referral_code;

  let code = generateReferralCode(username);
  let attempts = 0;
  while (attempts < 10) {
    const { error } = await supabase
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", userId);
    if (!error) return code;
    if (error.code === "23505") {
      code = generateReferralCode(username + String(attempts));
      attempts++;
    } else {
      throw error;
    }
  }
  return code;
}

/**
 * Complete a referral: pay 50 SK to both referrer and referred user after first deposit ($5+).
 * Call after crediting the deposit. Idempotent (checks status) and enforces anti-abuse rules.
 */
export async function completeReferral(
  supabase: SupabaseClient,
  userId: string,
  depositAmount: number
): Promise<void> {
  if (depositAmount < MIN_DEPOSIT_FOR_BONUS) return;

  const { data: referral } = await supabase
    .from("referrals")
    .select("*")
    .eq("referred_id", userId)
    .eq("status", "pending")
    .maybeSingle();

  if (!referral) return;
  if (referral.referrer_id === referral.referred_id) return;

  const { data: referrerProfile } = await supabase
    .from("profiles")
    .select("total_referrals, referral_earnings")
    .eq("id", referral.referrer_id)
    .single();

  const totalReferrals = Number(referrerProfile?.total_referrals ?? 0);
  if (totalReferrals >= MAX_REFERRAL_BONUSES_PER_USER) return;

  const { data: referredWallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!referredWallet) return;
  const newPlayerBalance = Number(referredWallet.balance) + BONUS_AMOUNT;

  await supabase
    .from("wallets")
    .update({ balance: newPlayerBalance })
    .eq("user_id", userId);

  await supabase.from("transactions").insert({
    user_id: userId,
    type: "referral_bonus",
    amount: BONUS_AMOUNT,
    balance_after: newPlayerBalance,
    description: "Referral signup bonus — welcome to SkillFlow!",
    status: "completed",
  });

  const { data: referrerWallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", referral.referrer_id)
    .single();

  if (referrerWallet) {
    const referrerBalance = Number(referrerWallet.balance) + BONUS_AMOUNT;
    await supabase
      .from("wallets")
      .update({ balance: referrerBalance })
      .eq("user_id", referral.referrer_id);

    await supabase.from("transactions").insert({
      user_id: referral.referrer_id,
      type: "referral_bonus",
      amount: BONUS_AMOUNT,
      balance_after: referrerBalance,
      description: "Referral bonus — your friend joined SkillFlow!",
      status: "completed",
    });
  }

  const now = new Date().toISOString();
  await supabase
    .from("referrals")
    .update({
      status: "completed",
      referrer_bonus_paid: true,
      referred_bonus_paid: true,
      completed_at: now,
    })
    .eq("id", referral.id);

  await supabase
    .from("profiles")
    .update({
      total_referrals: totalReferrals + 1,
      referral_earnings: Number(referrerProfile?.referral_earnings ?? 0) + BONUS_AMOUNT,
      updated_at: now,
    })
    .eq("id", referral.referrer_id);
}
