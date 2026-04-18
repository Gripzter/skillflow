"use client";

type RankTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";
type RankBadgeSize = "small" | "large";

interface RankBadgeProps {
  tier: string;
  size?: RankBadgeSize;
}

function toTier(tier: string): RankTier {
  if (
    tier === "bronze" ||
    tier === "silver" ||
    tier === "gold" ||
    tier === "platinum" ||
    tier === "diamond"
  ) {
    return tier;
  }
  return "bronze";
}

const TIER_COLORS: Record<RankTier, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#00CED1",
  diamond: "#B9F2FF",
};

export default function RankBadge({ tier, size = "small" }: RankBadgeProps) {
  const normalizedTier = toTier(tier.toLowerCase());
  const color = TIER_COLORS[normalizedTier];
  const isLarge = size === "large";

  return (
    <span
      className={`inline-flex items-center rounded-full border bg-[#0E0E12] font-semibold uppercase tracking-[0.12em] ${
        isLarge ? "gap-2 px-3 py-1.5 text-xs" : "gap-1.5 px-2 py-1 text-[10px]"
      }`}
      style={{
        borderColor: `${color}66`,
        color,
      }}
    >
      <span
        className={isLarge ? "h-2.5 w-2.5 rounded-full" : "h-2 w-2 rounded-full"}
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {normalizedTier}
    </span>
  );
}
