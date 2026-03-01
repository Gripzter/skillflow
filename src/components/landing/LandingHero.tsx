"use client";

import Link from "next/link";

export default function LandingHero() {
  const scrollToHow = () => {
    document.querySelector("#how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden px-4 pt-24 pb-16 sm:px-6 sm:pt-28 lg:flex lg:min-h-[90vh] lg:items-center lg:px-8 lg:pt-32"
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0A0E17] via-[#0D1117] to-[#0A0E17]" />
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-60" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-96 w-96 rounded-full bg-teal/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 left-0 h-64 w-64 rounded-full bg-teal/5 blur-3xl" />
      {/* Floating shapes */}
      <div className="pointer-events-none absolute right-[10%] top-[20%] h-3 w-3 rounded-full bg-teal/30 animate-float" />
      <div className="pointer-events-none absolute right-[25%] top-[40%] h-2 w-2 rounded-full bg-teal/20 animate-float" style={{ animationDelay: "-2s" }} />
      <div className="pointer-events-none absolute right-[15%] bottom-[30%] h-2 w-2 rounded-full bg-white/10 animate-float" style={{ animationDelay: "-4s" }} />

      <div className="relative mx-auto max-w-6xl lg:flex lg:w-full lg:items-center lg:justify-between">
        <div className="lg:w-[58%]">
          <div className="inline-flex items-center rounded-full border border-teal/30 bg-teal/10 px-3 py-1.5 text-xs font-medium text-teal shadow-[0_0_20px_rgba(0,229,199,0.15)] sm:text-sm">
            🔥 Real Money • Real Skill • Real Wins
          </div>
          <h1 className="mt-6 text-[32px] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-5xl lg:text-6xl">
            <span className="hero-word hero-word-1 block">Compete.</span>
            <span className="hero-word hero-word-2 block">Win.</span>
            <span className="hero-word hero-word-3 block">
              <span className="text-teal">Cash Out.</span>
            </span>
          </h1>
          <p className="mt-6 max-w-lg text-base text-body-gray sm:text-lg">
            Challenge real players in skill-based games. No luck. No house edge. Pure skill decides who wins.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/signup"
              className="flex min-h-[48px] items-center justify-center rounded-lg bg-teal px-8 py-3.5 text-lg font-semibold text-charcoal transition-all hover:shadow-teal-glow animate-cta-pulse"
            >
              🎮 Start Playing
            </Link>
            <button
              type="button"
              onClick={scrollToHow}
              className="flex min-h-[48px] items-center justify-center rounded-lg border border-white/30 bg-transparent px-8 py-3.5 text-lg font-semibold text-white transition-colors hover:bg-white/5"
            >
              👀 See How It Works
            </button>
          </div>
          <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-body-gray">
            <span>✅ 18+ only</span>
            <span>🔒 Secured by Stripe</span>
            <span>🎯 100% skill-based</span>
          </p>
        </div>

        <div className="relative mt-12 flex justify-center lg:mt-0 lg:w-[42%]">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <span className="text-5xl opacity-90 sm:text-6xl lg:text-7xl" title="8 Ball Pool">🎱</span>
            <span className="text-5xl opacity-90 sm:text-6xl lg:text-7xl" title="Chess">♟️</span>
            <span className="text-5xl opacity-90 sm:text-6xl lg:text-7xl" title="Connect 4">🔴</span>
            <span className="text-5xl opacity-90 sm:text-6xl lg:text-7xl" title="Reaction Duel">⚡</span>
            <span className="text-5xl opacity-90 sm:text-6xl lg:text-7xl" title="Spelling Bee">🐝</span>
          </div>
          <p className="mt-4 text-center text-sm text-body-gray">Play now. Win real money.</p>
        </div>
      </div>
    </section>
  );
}
