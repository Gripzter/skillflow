"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type OnboardingStep = 0 | 1 | 2 | 3;

interface OnboardingFlowProps {
  userId: string;
  onComplete: () => void;
}

type GameCard = {
  slug: string;
  name: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
};

const FIRST_GAMES: GameCard[] = [
  {
    slug: "chess",
    name: "Chess",
    description: "Classic strategy. Outsmart your opponent move by move.",
    difficulty: "Hard",
  },
  {
    slug: "connect-4",
    name: "Connect 4",
    description: "Fast tactical battles with simple rules and big mind games.",
    difficulty: "Easy",
  },
  {
    slug: "reaction-duel",
    name: "Reaction Duel",
    description: "Speed wins. React faster than your opponent under pressure.",
    difficulty: "Medium",
  },
  {
    slug: "memory-match",
    name: "Memory Match",
    description: "Flip, remember, and chain matches to take the lead.",
    difficulty: "Easy",
  },
  {
    slug: "checkers",
    name: "Checkers",
    description: "Quick tactical turns with clean, competitive gameplay.",
    difficulty: "Medium",
  },
  {
    slug: "spelling-bee",
    name: "Spelling Bee",
    description: "Spell under pressure and score with speed plus accuracy.",
    difficulty: "Medium",
  },
];

function DifficultyBadge({ value }: { value: GameCard["difficulty"] }) {
  const classes =
    value === "Easy"
      ? "border-emerald-400/35 bg-emerald-400/15 text-emerald-200"
      : value === "Hard"
        ? "border-orange-400/35 bg-orange-400/15 text-orange-200"
        : "border-amber-300/35 bg-amber-300/15 text-amber-100";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes}`}>
      {value}
    </span>
  );
}

export default function OnboardingFlow({ userId, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>(0);
  const [saving, setSaving] = useState(false);

  const founderProgress = useMemo(() => Math.min(100, (1000 / 10000) * 100), []);

  async function markOnboardingComplete() {
    if (saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase
          .from("profiles")
          .update({
            onboarding_completed: true,
            founders_prompt_shown: true,
          })
          .eq("id", userId);

        if (error?.code === "42703") {
          await supabase
            .from("profiles")
            .update({ founders_prompt_shown: true })
            .eq("id", userId);
        }
      }
    } finally {
      onComplete();
    }
  }

  async function handleChooseGame(slug: string) {
    await markOnboardingComplete();
    window.location.href = `/play/${slug}`;
  }

  async function handleSkip() {
    await markOnboardingComplete();
    window.location.href = "/dashboard";
  }

  return (
    <div className="fixed inset-0 z-[110] flex min-h-screen w-full items-center justify-center overflow-y-auto bg-[#05060B]/95 px-4 py-6">
      <div className="relative w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0C101A] p-6 shadow-[0_0_80px_rgba(0,0,0,0.55)] md:p-10">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(255,94,0,0.12),transparent_55%)]" />
        <div className="relative flex min-h-[560px] flex-col">
          <div className="mb-6 flex items-center justify-between">
            <div className="logo text-lg font-bold tracking-tight text-white md:text-2xl">SkillFlow</div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              Step {step + 1} of 4
            </div>
          </div>

          {step === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <h2 className="animate-[fadeInUp_700ms_ease-out] text-4xl font-black tracking-tight text-white md:text-6xl">
                Welcome to SkillFlow
              </h2>
              <p className="mt-4 max-w-2xl text-base text-gray-300 md:text-lg">
                You just joined the beta. This is your chance to earn rewards that will never be
                available again.
              </p>
              <div className="gift-glow relative mt-10 w-full max-w-md overflow-hidden rounded-2xl border border-orange-400/35 bg-gradient-to-r from-orange-500/15 via-amber-300/10 to-orange-500/15 p-6 shadow-[0_0_40px_rgba(255,94,0,0.25)]">
                <div className="shimmer-band" />
                <p className="text-4xl font-black text-orange-300">+1,000 SP</p>
                <p className="mt-2 text-sm font-medium uppercase tracking-[0.14em] text-orange-100/80">
                  Your starting SkillPoints
                </p>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-1 flex-col">
              <h2 className="text-center text-3xl font-black text-white md:text-5xl">How It Works</h2>
              <div className="mt-8 grid flex-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">PLAY 🎮</p>
                  <p className="mt-3 text-sm leading-relaxed text-gray-200">
                    Compete in skill-based games against real players and bots. Chess, Connect 4,
                    Reaction Duel, and more.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">EARN 🏆</p>
                  <p className="mt-3 text-sm leading-relaxed text-gray-200">
                    Win matches to earn SkillPoints. Complete daily challenges for bonus SP. Every
                    match counts.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">OPEN 🎁</p>
                  <p className="mt-3 text-sm leading-relaxed text-gray-200">
                    Spend SP on Cases to win cosmetics, badges, and multipliers. The rarer the
                    drop, the bigger the flex.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-1 flex-col justify-center">
              <div className="relative overflow-hidden rounded-2xl border border-orange-300/45 bg-gradient-to-br from-[#101729] via-[#0E1320] to-[#140E1D] p-6 md:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,94,0,0.12),transparent_35%,rgba(168,85,247,0.12))]" />
                <div className="relative">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-200/90">
                    BETA FOUNDERS PROGRAM
                  </p>
                  <p className="mt-4 text-base text-gray-200 md:text-lg">
                    Reach Platinum rank during beta and unlock rewards that will NEVER be available
                    again:
                  </p>
                  <ul className="mt-5 space-y-3 text-sm text-gray-100">
                    <li>🔒 Permanent Founders badge</li>
                    <li>🔒 $10 starting credits at launch</li>
                    <li>🔒 3 free Case openings</li>
                  </ul>
                  <div className="mt-7">
                    <div className="mb-2 flex items-center justify-between text-xs text-gray-300">
                      <span>0/10,000 SP toward Platinum</span>
                      <span>10%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-300"
                        style={{ width: `${founderProgress}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-gray-200">
                      You have 1,000 SP. That&apos;s 10% of the way. Start playing to climb.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-1 flex-col">
              <h2 className="text-center text-3xl font-black text-white md:text-5xl">
                Choose Your First Game
              </h2>
              <p className="mt-3 text-center text-sm text-gray-300 md:text-base">
                Pick a game. Play your first match. Earn your first SP.
              </p>
              <div className="mt-7 grid gap-3 md:grid-cols-2">
                {FIRST_GAMES.map((game) => (
                  <button
                    key={game.slug}
                    type="button"
                    disabled={saving}
                    onClick={() => handleChooseGame(game.slug)}
                    className="group rounded-xl border border-white/12 bg-white/[0.03] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-orange-300/55 hover:bg-orange-500/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-base font-semibold text-white">{game.name}</p>
                      <DifficultyBadge value={game.difficulty} />
                    </div>
                    <p className="mt-2 text-sm text-gray-300">{game.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-8">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => (Math.min(3, prev + 1) as OnboardingStep))}
                className="w-full rounded-xl bg-orange-500 px-5 py-3 text-base font-bold text-white transition hover:bg-orange-400"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSkip}
                disabled={saving}
                className="mx-auto block text-sm text-gray-300 underline-offset-4 hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .gift-glow {
          animation: pulseGlow 2.2s ease-in-out infinite;
        }
        .shimmer-band {
          position: absolute;
          top: 0;
          left: -35%;
          width: 35%;
          height: 100%;
          background: linear-gradient(
            120deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.36) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: shimmerMove 2.8s linear infinite;
        }
        @keyframes pulseGlow {
          0%,
          100% {
            box-shadow: 0 0 26px rgba(255, 94, 0, 0.28);
          }
          50% {
            box-shadow: 0 0 38px rgba(255, 94, 0, 0.42);
          }
        }
        @keyframes shimmerMove {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(430%);
          }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
