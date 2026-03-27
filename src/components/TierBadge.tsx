"use client";

import { getTier, TIER_INFO, type Tier } from "@/lib/ranking/tiers";

interface TierBadgeProps {
  /** Pass either a tier name or a numeric rating */
  tier?: Tier | string;
  rating?: number;
  /** "xs" | "sm" | "md" */
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
}

const SIZE_MAP = {
  xs: { dot: "h-2 w-2", text: "text-[9px]", badge: "px-1.5 py-0.5 text-[9px]" },
  sm: { dot: "h-2.5 w-2.5", text: "text-[11px]", badge: "px-2 py-0.5 text-[11px]" },
  md: { dot: "h-3 w-3", text: "text-[13px]", badge: "px-2.5 py-1 text-[13px]" },
};

export default function TierBadge({
  tier,
  rating,
  size = "sm",
  showLabel = true,
}: TierBadgeProps) {
  const resolvedTier: Tier =
    tier && Object.keys(TIER_INFO).includes(tier as Tier)
      ? (tier as Tier)
      : rating !== undefined
      ? getTier(rating)
      : "bronze";

  const info = TIER_INFO[resolvedTier];
  const sz = SIZE_MAP[size];

  const isMaster = resolvedTier === "master";

  const bgStyle: React.CSSProperties = isMaster
    ? { background: info.gradient ?? info.color }
    : { background: info.color };

  if (!showLabel) {
    return (
      <span
        className={`inline-block shrink-0 rounded-full ${sz.dot}`}
        style={bgStyle}
        title={info.label}
        aria-label={`${info.label} tier`}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold uppercase tracking-wide text-white ${sz.badge}`}
      style={bgStyle}
      title={info.description}
    >
      {info.label}
    </span>
  );
}
