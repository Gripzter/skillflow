"use client";

import type { DailyChallengeRow } from "@/lib/daily-challenges";

type Props = {
  challenges: DailyChallengeRow[];
  visible: boolean;
};

export default function GameCardChallenges({ challenges, visible }: Props) {
  if (challenges.length === 0) return null;

  return (
    <div
      className={`
        absolute top-3 left-3 right-3 z-20 hidden [@media(hover:hover)]:block
        rounded-xl px-3 py-2.5
        bg-black/55 backdrop-blur-md
        border border-white/10
        transition-all duration-200 ease-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"}
      `}
    >
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
        Daily Challenges
      </div>
      <ul className="space-y-1">
        {challenges.map((challenge) => {
          const done = challenge.progress >= challenge.target;
          return (
            <li key={challenge.id} className="flex items-start gap-2 text-[12px]">
              <span
                className={`
                  inline-flex items-center justify-center
                  mt-0.5 w-3.5 h-3.5 rounded-full shrink-0
                  ${done ? "bg-[#FFFF00] text-black" : "border border-white/30 bg-transparent"}
                `}
              >
                {done && <span className="text-[8px] leading-none font-black">✓</span>}
              </span>
              <span className={`flex-1 whitespace-normal break-words leading-snug ${done ? "text-white/50 line-through" : "text-white/90"}`}>
                {challenge.description}
              </span>
              <span className="shrink-0 text-[11px] text-white/50">
                {challenge.progress}/{challenge.target}
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-[#FFFF00]">
                +{challenge.reward_sp} SK
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
