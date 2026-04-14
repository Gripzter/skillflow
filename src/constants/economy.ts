"use client";

export const LAUNCH_MODE = process.env.NEXT_PUBLIC_LAUNCH_MODE?.toUpperCase() ?? "";
export const IS_SWEEPSTAKES_LAUNCH = LAUNCH_MODE === "SWEEPSTAKES";

export const SKILL_POINTS_NAME = "SkillPoints";
export const SKILL_POINTS_ICON = "SP";
export const WEEKLY_PRIZE_POOL_USD = 100;

export const PRIZE_POOL_BANNER_TEXT =
  "Weekly Alpha Tournament: $100 Prize Pool. Play for Free. Win for Real.";

export const WAITLIST_EMAIL_KEY = "skillflow_waitlist_email";
export const WAITLIST_UNLOCKED_KEY = "skillflow_waitlist_unlocked";

export function formatEconomyAmount(amount: number): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return IS_SWEEPSTAKES_LAUNCH
    ? `${formatted} ${SKILL_POINTS_ICON}`
    : `$${formatted}`;
}
