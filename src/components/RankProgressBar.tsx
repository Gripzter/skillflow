"use client";

import SPIcon from "@/components/SPIcon";

type RankTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

interface RankProgressBarProps {
  lifetimeSp: number;
  currentTier: string;
}

type TierMeta = {
  key: RankTier;
  label: string;
  min: number;
  max: number | null;
  color: string;
};

const TIERS: TierMeta[] = [
  { key: "bronze", label: "Bronze", min: 0, max: 1999, color: "#CD7F32" },
  { key: "silver", label: "Silver", min: 2000, max: 4999, color: "#C0C0C0" },
  { key: "gold", label: "Gold", min: 5000, max: 9999, color: "#FFD700" },
  { key: "platinum", label: "Platinum", min: 10000, max: 19999, color: "#00CED1" },
  { key: "diamond", label: "Diamond", min: 20000, max: null, color: "#B9F2FF" },
];

function normalizeTier(tier: string): RankTier {
  const normalized = tier.toLowerCase();
  if (
    normalized === "bronze" ||
    normalized === "silver" ||
    normalized === "gold" ||
    normalized === "platinum" ||
    normalized === "diamond"
  ) {
    return normalized;
  }
  return "bronze";
}

export default function RankProgressBar({ lifetimeSp, currentTier }: RankProgressBarProps) {
  const normalizedTier = normalizeTier(currentTier);
  const currentTierMeta = TIERS.find((tier) => tier.key === normalizedTier) ?? TIERS[0];
  const currentIndex = TIERS.findIndex((tier) => tier.key === currentTierMeta.key);
  const nextTierMeta = currentIndex >= 0 && currentIndex < TIERS.length - 1 ? TIERS[currentIndex + 1] : null;

  const isMaxTier = !nextTierMeta;
  const fillPercent = isMaxTier
    ? 100
    : Math.max(
        0,
        Math.min(
          100,
          ((lifetimeSp - currentTierMeta.min) / (nextTierMeta.min - currentTierMeta.min)) * 100
        )
      );

  const progressColor = nextTierMeta?.color ?? currentTierMeta.color;
  const progressMax = nextTierMeta?.min ?? currentTierMeta.min;
  const lifetimeFormatted = lifetimeSp.toLocaleString();
  const maxFormatted = progressMax.toLocaleString();

  return (
    <div className="rounded-xl border border-white/10 bg-[#0E0E12] p-4">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em]">
        <span style={{ color: currentTierMeta.color }}>{currentTierMeta.label}</span>
        <span style={{ color: nextTierMeta?.color ?? "#B9F2FF" }}>
          {nextTierMeta ? nextTierMeta.label : "MAX RANK"}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${fillPercent}%`,
            backgroundColor: progressColor,
          }}
        />
      </div>
      <p className="mt-2 text-xs text-body-gray">
        {isMaxTier ? (
          <>
            <span className="inline-flex items-center gap-1">
              {lifetimeFormatted} <SPIcon size={12} />
            </span>{" "}
            / MAX RANK
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              {lifetimeFormatted} <SPIcon size={12} />
            </span>{" "}
            /{" "}
            <span className="inline-flex items-center gap-1">
              {maxFormatted} <SPIcon size={12} />
            </span>
          </>
        )}
      </p>
    </div>
  );
}
