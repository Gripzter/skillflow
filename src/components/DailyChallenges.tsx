"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { PlayerDailyChallenge } from "@/lib/challengeProgress";
import { CHALLENGE_GAME_TO_SLUG, type ChallengeGame } from "@/lib/challengeGames";

type DailyChallengesProps = {
  challenges: PlayerDailyChallenge[];
  onClaimed?: (slotId: string, rewardSk: number) => void;
  onRefresh?: () => void;
};

const GAME_DOT_COLORS: Record<ChallengeGame, string> = {
  connect4: "#3B82F6",
  chess: "#FFFFFF",
  reaction_duel: "#EF4444",
  spelling_bee: "#A855F7",
  memory_match: "#22C55E",
  checkers: "#F97316",
  any: "#FFFF00",
};

function msUntilUtcMidnight(now = new Date()): number {
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return Math.max(0, midnight.getTime() - now.getTime());
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DailyChallenges({
  challenges,
  onClaimed,
  onRefresh,
}: DailyChallengesProps) {
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilUtcMidnight()));

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(msUntilUtcMidnight()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleClaim = useCallback(
    async (slotId: string) => {
      setClaimingId(slotId);
      try {
        const supabase = createClient();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (supabase) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
          }
        }

        const res = await fetch("/api/challenges/claim", {
          method: "POST",
          headers,
          body: JSON.stringify({ slotId }),
        });
        const data = (await res.json()) as { rewardSk?: number; error?: string };
        if (res.ok && data.rewardSk != null) {
          onClaimed?.(slotId, data.rewardSk);
          onRefresh?.();
        }
      } finally {
        setClaimingId(null);
      }
    },
    [onClaimed, onRefresh]
  );

  if (challenges.length === 0) return null;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-[#16161C] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#FFFF00]">
          Daily Challenges
        </h2>
        <span className="shrink-0 text-[11px] text-[#9CA3AF]">
          Resets in: <span className="font-mono text-white">{countdown}</span>
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {challenges.map((challenge) => {
          const pct = Math.min(
            100,
            Math.round((challenge.progress / Math.max(1, challenge.targetValue)) * 100)
          );
          const slug = CHALLENGE_GAME_TO_SLUG[challenge.game];

          return (
            <div key={challenge.slotId} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  challenge.completed
                    ? "border-[#FFFF00] bg-[#FFFF00]"
                    : "border-white/25 bg-transparent"
                }`}
              >
                {challenge.completed ? (
                  <span className="text-[11px] font-black text-black">✓</span>
                ) : null}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: GAME_DOT_COLORS[challenge.game] }}
                    title={challenge.game}
                  />
                  <p className="flex-1 text-sm font-medium leading-snug text-white whitespace-normal break-words">
                    {challenge.title}
                  </p>
                  <div className="shrink-0 pl-2">
                    {challenge.completed && !challenge.rewardClaimed ? (
                      <button
                        type="button"
                        disabled={claimingId === challenge.slotId}
                        onClick={() => void handleClaim(challenge.slotId)}
                        className="rounded-md bg-[#FFFF00] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-black disabled:opacity-50"
                      >
                        {claimingId === challenge.slotId ? "…" : "Claim"}
                      </button>
                    ) : challenge.completed && challenge.rewardClaimed ? (
                      <span className="text-[11px] text-[#6B7280]">✓ Claimed</span>
                    ) : (
                      <span className="text-[12px] font-semibold text-[#FFFF00]">
                        {challenge.bonusType === "second_chance" ? "second chance" : `+${challenge.rewardSk} SK`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#FFFF00] transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-[#9CA3AF]">
                    {challenge.progress}/{challenge.targetValue}
                  </span>
                </div>

                {slug ? (
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-[#6B7280]">
                    {slug.replace("-", " ")}
                    {challenge.bonusType === "second_chance" ? " · a little extra for next time" : ""}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export type { PlayerDailyChallenge };
