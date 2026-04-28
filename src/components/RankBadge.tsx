"use client";

import Image from "next/image";

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

const TIER_IMAGES: Record<RankTier, string> = {
  bronze: "/images/rank-bronze.png",
  silver: "/images/rank-silver.png",
  gold: "/images/rank-gold.png",
  platinum: "/images/rank-platinum.png",
  diamond: "/images/rank-diamond.png",
};

export default function RankBadge({ tier, size = "small" }: RankBadgeProps) {
  const normalizedTier = toTier(tier.toLowerCase());
  const pixelSize = size === "large" ? 40 : 24;

  return (
    <span className="inline-flex items-center" title={normalizedTier}>
      <Image
        src={TIER_IMAGES[normalizedTier]}
        alt={`${normalizedTier} rank`}
        width={pixelSize}
        height={pixelSize}
        className="h-auto w-auto"
      />
    </span>
  );
}
