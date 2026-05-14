"use client";

import { useMemo, useState } from "react";
import SkilliesIcon from "@/components/SkilliesIcon";

const DAILY_REWARD_SCHEDULE = [50, 75, 100, 150, 200, 300, 500] as const;

type DailyLoginRewardProps = {
  isOpen: boolean;
  streakDay: number;
  rewardAmount: number;
  claiming: boolean;
  onClaim: () => Promise<void>;
};

export default function DailyLoginReward({
  isOpen,
  streakDay,
  rewardAmount,
  claiming,
  onClaim,
}: DailyLoginRewardProps) {
  const [claimFx, setClaimFx] = useState(false);

  const currentDay = Math.min(Math.max(streakDay, 1), DAILY_REWARD_SCHEDULE.length);
  const dayCards = useMemo(
    () =>
      DAILY_REWARD_SCHEDULE.map((amount, index) => {
        const day = index + 1;
        return { day, amount, isPast: day < currentDay, isCurrent: day === currentDay };
      }),
    [currentDay]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-charcoal/90 px-4">
      <div
        className={`relative w-full max-w-2xl rounded-card border border-orange-500/35 bg-card p-6 shadow-[0_0_40px_rgba(255, 255, 0, 0.25)] transition-transform duration-200 ${
          claimFx ? "scale-[1.02]" : "scale-100"
        }`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-400">
              Daily Login Reward
            </p>
            <h2 className="mt-1 text-2xl font-extrabold text-white">Day {currentDay} Reward</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-orange-400/40 bg-orange-500/10 px-3 py-2 text-orange-300">
            <span className="text-lg font-bold">{rewardAmount.toLocaleString()} Skillies</span>
            <SkilliesIcon size={18} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {dayCards.map((item) => (
            <div
              key={item.day}
              className={`rounded-lg border px-2 py-3 text-center transition-colors ${
                item.isCurrent
                  ? "border-orange-400 bg-orange-500/15"
                  : item.isPast
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-white/10 bg-black/20"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-body-gray">
                Day {item.day}
              </p>
              <p className="mt-1 inline-flex items-center justify-center gap-1 text-sm font-semibold text-white">
                {item.amount} Skillies <SkilliesIcon size={12} />
              </p>
              <p className="mt-1 text-xs">
                {item.isPast ? "✓" : item.isCurrent ? "Today" : ""}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={claiming}
          onClick={async () => {
            setClaimFx(true);
            await onClaim();
            setTimeout(() => setClaimFx(false), 350);
          }}
          className="mt-6 w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {claiming ? "Claiming..." : `Claim ${rewardAmount.toLocaleString()} Skillies`}
        </button>
      </div>
    </div>
  );
}
