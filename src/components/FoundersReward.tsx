"use client";

import Image from "next/image";
import SPIcon from "@/components/SPIcon";

interface FoundersRewardProps {
  lifetimeSp: number;
  currentTier: string;
}

const PLATINUM_THRESHOLD = 10000;
const REWARDS = [
  'Permanent "Founders" badge (never available again)',
  "$10 starting credits at real-money launch",
  "3 free Case openings",
];

function normalizeTier(tier: string): string {
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

export default function FoundersReward({ lifetimeSp, currentTier }: FoundersRewardProps) {
  const tier = normalizeTier(currentTier);
  const unlocked = tier === "platinum" || tier === "diamond" || lifetimeSp >= PLATINUM_THRESHOLD;
  const spRemaining = Math.max(0, PLATINUM_THRESHOLD - lifetimeSp);
  const progressPercent = Math.max(0, Math.min(100, (lifetimeSp / PLATINUM_THRESHOLD) * 100));

  return (
    <section
      className={`relative overflow-hidden rounded-card border p-5 ${
        unlocked
          ? "border-[#FFB347]/50 bg-[radial-gradient(circle_at_top_right,rgba(255,179,71,0.2),transparent_45%),linear-gradient(135deg,rgba(255, 255, 0, 0.18),rgba(12,12,16,0.9))]"
          : "border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255, 255, 0, 0.14),transparent_45%),rgba(16,16,22,0.82)]"
      }`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#FFB347]/20 blur-2xl" aria-hidden />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image
            src="/images/badge-founders.png"
            alt="Founders badge"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFB347]">
            Beta Founders Program
          </p>
          <h3 className="mt-1 text-lg font-bold text-white">FOUNDERS REWARD</h3>
          </div>
        </div>
        {unlocked ? (
          <span className="rounded-full border border-[#FFB347]/60 bg-[#FFB347]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#FFD700]">
            Unlocked
          </span>
        ) : (
          <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-body-gray">
            Locked
          </span>
        )}
      </div>

      {!unlocked ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-[0.12em] text-body-gray">Platinum Progress</span>
            <span className="font-semibold text-[#FFB347]">{progressPercent.toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-[#FFFF00] to-[#FFB347]" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="mt-2 text-xs text-body-gray">
            <span className="inline-flex items-center gap-1">
              {lifetimeSp.toLocaleString()} <SPIcon size={12} />
            </span>{" "}
            /{" "}
            <span className="inline-flex items-center gap-1">
              {PLATINUM_THRESHOLD.toLocaleString()} <SPIcon size={12} />
            </span>
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {REWARDS.map((reward) => (
          <div
            key={reward}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              unlocked ? "border border-[#FFB347]/35 bg-[#FFB347]/12 text-[#FFE3B3]" : "border border-white/10 bg-black/30 text-gray-400"
            }`}
          >
            <span className={unlocked ? "text-[#FFD700]" : "text-gray-500"}>
              {unlocked ? "✓" : "•"}
            </span>
            <span>{reward}</span>
          </div>
        ))}
      </div>

      <p className={`mt-4 text-sm ${unlocked ? "text-[#FFD700]" : "text-body-gray"}`}>
        {unlocked
          ? "Founders rewards secured. This beta-only bundle is permanently exclusive and can never be earned again."
          : `Reach Platinum to unlock. ${spRemaining.toLocaleString()} to go before this limited-time beta window closes.`}
        {!unlocked ? <SPIcon size={14} className="ml-1" /> : null}
      </p>
    </section>
  );
}
