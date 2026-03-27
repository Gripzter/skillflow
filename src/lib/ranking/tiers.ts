/**
 * Tier definitions for the SkillFlow ranking system.
 */

export type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";

export interface TierInfo {
  name: string;
  label: string;
  minRating: number;
  maxRating: number;
  color: string;
  /** For Master tier only — CSS gradient string */
  gradient?: string;
  description: string;
}

export const TIER_INFO: Record<Tier, TierInfo> = {
  bronze: {
    name: "bronze",
    label: "Bronze",
    minRating: 0,
    maxRating: 899,
    color: "#8B5E3C",
    description: "New to the arena. Keep playing to climb the ranks.",
  },
  silver: {
    name: "silver",
    label: "Silver",
    minRating: 900,
    maxRating: 1099,
    color: "#A8A8A8",
    description: "Solid fundamentals. You're finding your footing.",
  },
  gold: {
    name: "gold",
    label: "Gold",
    minRating: 1100,
    maxRating: 1299,
    color: "#D4AF37",
    description: "Consistent and dangerous. The competition is fierce.",
  },
  platinum: {
    name: "platinum",
    label: "Platinum",
    minRating: 1300,
    maxRating: 1499,
    color: "#40B5C4",
    description: "Elite-level play. Few reach this tier.",
  },
  diamond: {
    name: "diamond",
    label: "Diamond",
    minRating: 1500,
    maxRating: 1699,
    color: "#6366F1",
    description: "Top percentile. You're among the very best.",
  },
  master: {
    name: "master",
    label: "Master",
    minRating: 1700,
    maxRating: Infinity,
    color: "#F59E0B",
    gradient: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
    description: "Legendary. Only a handful of players achieve this rank.",
  },
};

/** Get tier from a numeric rating */
export function getTier(rating: number): Tier {
  if (rating >= 1700) return "master";
  if (rating >= 1500) return "diamond";
  if (rating >= 1300) return "platinum";
  if (rating >= 1100) return "gold";
  if (rating >= 900) return "silver";
  return "bronze";
}

/** Ordered list of tiers from lowest to highest */
export const TIER_ORDER: Tier[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "master",
];

/** Progress within the current tier as 0-100 */
export function tierProgress(rating: number): number {
  const tier = getTier(rating);
  const info = TIER_INFO[tier];
  if (tier === "master") return 100;
  const range = info.maxRating - info.minRating + 1;
  return Math.min(100, Math.max(0, ((rating - info.minRating) / range) * 100));
}
