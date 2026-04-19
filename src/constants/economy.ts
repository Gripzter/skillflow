"use client";

import { formatCurrency } from "@/lib/formatCurrency";

export const LAUNCH_MODE = process.env.NEXT_PUBLIC_LAUNCH_MODE?.toUpperCase() ?? "";
export const IS_SWEEPSTAKES_LAUNCH = LAUNCH_MODE === "SWEEPSTAKES";

export const SKILL_POINTS_NAME = "SkillPoints";
export const SKILL_POINTS_ICON = "SP";
export const WEEKLY_PRIZE_POOL_USD = 100;
export const LAST_TOUCH_FEATURED_PRIZE_POOL_SP = 1247;

export const PRIZE_POOL_BANNER_TEXT =
  "Beta Season Live — Earn SkillPoints. Climb Ranks. Unlock Founders Rewards.";

export const WAITLIST_EMAIL_KEY = "skillflow_waitlist_email";
export const WAITLIST_UNLOCKED_KEY = "skillflow_waitlist_unlocked";

export function formatEconomyAmount(amount: number): string {
  return formatCurrency(amount);
}
