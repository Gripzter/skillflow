"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase";

type OnboardingStep = 0 | 1 | 2 | 3;

interface OnboardingFlowProps {
  userId: string;
  onComplete: () => void;
}

type GameCard = {
  slug: string;
  emoji: string;
  name: string;
  tagline: string;
};

const FIRST_GAMES: GameCard[] = [
  {
    slug: "chess",
    emoji: "♟️",
    name: "Chess",
    tagline: "Classic strategy",
  },
  {
    slug: "connect-4",
    emoji: "🔴",
    name: "Connect 4",
    tagline: "Drop to connect",
  },
  {
    slug: "reaction-duel",
    emoji: "⚡",
    name: "Reaction Duel",
    tagline: "Test your reflexes",
  },
  {
    slug: "memory-match",
    emoji: "🧠",
    name: "Memory Match",
    tagline: "Match the pairs",
  },
  {
    slug: "checkers",
    emoji: "🏁",
    name: "Checkers",
    tagline: "Jump and king",
  },
  {
    slug: "spelling-bee",
    emoji: "📝",
    name: "Spelling Bee",
    tagline: "Word power",
  },
];

export default function OnboardingFlow({ userId, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>(0);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const founderProgress = 10;

  useEffect(() => {
    setMounted(true);
  }, []);

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
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-[#0E0E12] text-white">
      {step < 3 ? (
        <button
          type="button"
          onClick={handleSkip}
          disabled={saving}
          className="absolute right-4 top-4 z-20 text-sm text-gray-500 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Skip
        </button>
      ) : null}

      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full text-center">
          <p className="inline-flex rounded-full border border-[#2A2A3A] bg-[#1A1A24] px-4 py-1.5 text-base font-semibold tracking-wide text-white">
            SkillFlow
          </p>
        </div>

        <div className="mt-8 w-full">
          {step === 0 && (
            <div className="mx-auto w-full max-w-lg space-y-8 text-center">
              <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                Welcome to SkillFlow
              </h2>
              <p className="text-base text-gray-400 md:text-lg">
                You just joined the beta. This is your chance to earn rewards that will never be
                available again.
              </p>
              <div className="mx-auto w-full max-w-xs rounded-2xl border border-[#2A2A3A] bg-[#1A1A24] p-6">
                <p className="text-4xl font-black text-white md:text-5xl">+1,000 SP</p>
                <p className="mt-2 text-sm text-gray-400">Your starting SkillPoints</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="mx-auto w-full max-w-lg space-y-8 text-center">
              <h2 className="text-3xl font-black text-white md:text-5xl">How It Works</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-xl border border-[#2A2A3A] bg-[#1A1A24] p-6 text-center">
                  <p className="text-3xl">🎮</p>
                  <p className="mt-3 text-sm font-bold uppercase tracking-wider text-white">PLAY</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">
                    Compete in skill-based games against real players and bots. Chess, Connect 4,
                    Reaction Duel, and more.
                  </p>
                </article>
                <article className="rounded-xl border border-[#2A2A3A] bg-[#1A1A24] p-6 text-center">
                  <p className="text-3xl">🏆</p>
                  <p className="mt-3 text-sm font-bold uppercase tracking-wider text-white">EARN</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">
                    Win matches to earn SkillPoints. Complete daily challenges for bonus SP. Every
                    match counts.
                  </p>
                </article>
                <article className="rounded-xl border border-[#2A2A3A] bg-[#1A1A24] p-6 text-center">
                  <p className="text-3xl">🎁</p>
                  <p className="mt-3 text-sm font-bold uppercase tracking-wider text-white">OPEN</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">
                    Spend SP on Cases to win cosmetics, badges, and multipliers. The rarer the
                    drop, the bigger the flex.
                  </p>
                </article>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mx-auto w-full max-w-lg space-y-8 text-center">
              <div className="w-full rounded-2xl bg-gradient-to-r from-[#FF5E00] to-[#FF8C00] p-px">
                <div className="rounded-2xl bg-[#1A1A24] p-6 md:p-8">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#FF5E00]">
                    BETA FOUNDERS PROGRAM
                  </p>
                  <p className="mt-4 text-base text-gray-300">
                    Reach Platinum rank during beta and unlock rewards that will NEVER be available
                    again:
                  </p>
                  <ul className="mt-5 space-y-2 text-sm text-white">
                    <li>🔒 Permanent Founders Badge</li>
                    <li>🔒 $10 Starting Credits at Launch</li>
                    <li>🔒 3 Free Case Openings</li>
                  </ul>
                  <div className="mt-6">
                    <div className="h-2 overflow-hidden rounded-full bg-[#2A2A3A]">
                      <div
                        className="h-full rounded-full bg-[#FF5E00]"
                        style={{ width: `${founderProgress}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-gray-400">
                      You have 1,000 SP. That&apos;s 10% of the way. Start playing to climb.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mx-auto w-full max-w-lg space-y-8 text-center">
              <h2 className="text-3xl font-black text-white md:text-5xl">
                Choose your first game
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {FIRST_GAMES.map((game) => (
                  <button
                    key={game.slug}
                    type="button"
                    disabled={saving}
                    onClick={() => handleChooseGame(game.slug)}
                    className="rounded-xl border border-[#2A2A3A] bg-[#1A1A24] p-4 text-left transition hover:scale-[1.02] hover:border-[#FF5E00] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <p className="text-2xl">{game.emoji}</p>
                    <p className="mt-2 text-sm font-semibold text-white md:text-base">{game.name}</p>
                    <p className="mt-1 text-xs text-gray-400 md:text-sm">{game.tagline}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center">
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (Math.min(3, prev + 1) as OnboardingStep))}
              className="w-full rounded-lg bg-[#FF5E00] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#e55300] md:w-[280px]"
            >
              Next
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
