"use client";

import { useEffect, useRef, useState } from "react";
import type { DailyChallengeRow } from "@/lib/daily-challenges";

type DailyChallengesStripProps = {
  challenges: DailyChallengeRow[];
};

function CompletionTick({ completed }: { completed: boolean }) {
  const [isScaledIn, setIsScaledIn] = useState(completed);
  const previousCompletedRef = useRef(completed);

  useEffect(() => {
    if (completed && !previousCompletedRef.current) {
      setIsScaledIn(false);
      const frame = window.requestAnimationFrame(() => {
        setIsScaledIn(true);
      });
      previousCompletedRef.current = completed;
      return () => window.cancelAnimationFrame(frame);
    }

    if (!completed) {
      setIsScaledIn(false);
    }

    previousCompletedRef.current = completed;
    return undefined;
  }, [completed]);

  return (
    <span
      className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border ${
        completed ? "border-[#FFFF00] bg-[#FFFF00]" : "border-white/20 bg-transparent"
      }`}
    >
      <span
        className={`text-[11px] font-bold text-black transition-transform duration-200 ${
          completed ? (isScaledIn ? "scale-100" : "scale-0") : "scale-0"
        }`}
      >
        ✓
      </span>
    </span>
  );
}

export default function DailyChallengesStrip({ challenges }: DailyChallengesStripProps) {

  if (challenges.length === 0) {
    return null;
  }

  return (
    <section className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.04] px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">Daily Challenges</p>
      <div className="mt-3 flex flex-col gap-3 md:flex-row md:gap-4">
        {challenges.map((challenge) => {
          return (
            <div
              key={challenge.id}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-white/5 bg-black/15 px-3 py-2"
            >
              <CompletionTick completed={challenge.completed} />
              <span className="truncate text-sm font-medium text-white">{challenge.description}</span>
              <span className="shrink-0 text-[13px] text-[#9CA3AF]">
                {Number(challenge.progress)}/{Number(challenge.target)}
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-[#FFFF00]">
                +{Number(challenge.reward_sp).toLocaleString()} SP
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
