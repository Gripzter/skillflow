"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { Lock } from "lucide-react";

function WaitlistForm({
  compact = false,
  helperText,
}: {
  compact?: boolean;
  helperText?: string;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || success) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!response.ok || !payload?.success) {
        setError(payload?.error ?? "Could not submit right now.");
        return;
      }
      setSuccess(true);
      setEmail("");
    } catch {
      setError("Could not submit right now.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return <p className="text-base font-medium text-white">You&apos;re on the list. Stand by.</p>;
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your@email.com"
          className={`w-full rounded-xl border border-white/20 bg-[#141419] px-4 text-white placeholder:text-white/35 focus:border-[#FFFF00] focus:outline-none focus:ring-2 focus:ring-[#FFFF00]/40 ${
            compact ? "h-12 text-base" : "h-14 text-lg"
          }`}
        />
        <button
          type="submit"
          disabled={submitting}
          className={`rounded-xl bg-[#FFFF00] px-6 font-semibold text-black transition hover:brightness-95 disabled:opacity-60 ${
            compact ? "h-12 text-base" : "h-14 text-lg"
          }`}
        >
          {submitting ? "Notifying..." : "Notify me \u2192"}
        </button>
      </form>
      {helperText ? <p className="mt-3 text-xs text-white/45">{helperText}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

const TEASER_GAMES = [
  {
    title: "Chess",
    subtitle: "Classic 1v1, Glicko-2 ranked",
    image: "/images/chess-card.png",
  },
  {
    title: "Connect 4",
    subtitle: "Speed-thinking grid duel",
    image: "/images/connect4-card.png",
  },
  {
    title: "Reaction Duel",
    subtitle: "Sub-200ms reflexes win",
    image: "/images/reaction-duel-card.png",
  },
];

const TIER_RANGES = [
  "0-1,999 SP",
  "2,000-4,999 SP",
  "5,000-9,999 SP",
  "10,000-19,999 SP",
  "20,000+ SP",
];

function LabelPill({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full border border-[#FFFF00]/60 bg-[#FFFF00]/10 px-4 py-1 text-xs font-semibold tracking-[0.18em] text-[#FFFF00]">
      {children}
    </span>
  );
}

export default function Home() {
  return (
    <main className="bg-[#0E0E12] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-[1360px] px-6 py-24 md:px-10">
        <div className="flex w-full flex-col lg:flex-row">
          <div className="w-full lg:w-3/5 lg:pr-12">
            <div className="flex items-center gap-3">
              <span className="h-5 w-[3px] bg-[#FFFF00]" />
              <span className="tracking-[0.12em] text-white/85">skillflow</span>
            </div>
            <LabelPill>COMING SOON</LabelPill>
            <h1 className="mt-6 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl md:text-8xl lg:text-[6.2rem] xl:text-[7.2rem]">
              <span className="block">Skillflow</span>
              <span className="block">Is</span>
              <span className="block">Coming.</span>
            </h1>
            <p className="mt-5 max-w-[500px] text-base text-white/60 sm:text-lg">
              A new way to play. A new way to win. The platform where skill pays.
            </p>
            <div className="mt-6 max-w-[620px]">
              <WaitlistForm
                helperText="First access. First advantages. Be early or be late."
              />
            </div>
          </div>
          <div className="hidden w-2/5 items-center justify-center lg:flex">
            <div className="h-[72vh] w-px bg-gradient-to-b from-transparent via-[#FFFF00]/55 to-transparent" />
          </div>
        </div>
      </section>

      <div className="mx-auto h-px w-full max-w-[1180px] bg-[#1a1a1f]" />

      <section className="mx-auto w-full max-w-[1180px] px-6 py-24 md:px-10">
        <LabelPill>EIGHT GAMES</LabelPill>
        <h2 className="mt-4 text-3xl font-bold sm:text-4xl">We have three you&apos;ll recognize.</h2>
        <p className="mt-2 text-base text-white/60 sm:text-lg">And five more you won&apos;t see coming.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {TEASER_GAMES.map((game) => (
            <article key={game.title} className="overflow-hidden rounded-2xl border border-white/10 bg-[#15151B]">
              <div className="relative aspect-[16/10] w-full">
                <Image src={game.image} alt={game.title} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>
              <div className="p-5">
                <h3 className="text-xl font-semibold text-white">{game.title}</h3>
                <p className="mt-2 text-sm text-white/60">{game.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-10 text-center">
          <p className="text-3xl font-bold text-[#FFFF00] sm:text-4xl">+5 more revealed at launch.</p>
          <p className="mt-2 text-base text-white sm:text-lg">Want to know what they are first?</p>
          <div className="mx-auto mt-5 max-w-[700px]">
            <WaitlistForm compact />
          </div>
        </div>
      </section>

      <div className="mx-auto h-px w-full max-w-[1180px] bg-[#1a1a1f]" />

      <section className="mx-auto w-full max-w-[1180px] px-6 py-24 md:px-10">
        <LabelPill>THE LADDER</LabelPill>
        <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Five tiers. One climb.</h2>
        <p className="mt-2 max-w-3xl text-base text-white/60 sm:text-lg">
          Earn SkillPoints for every match. Climb the ranks. Unlock rewards only the early players will ever see.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
          {TIER_RANGES.map((range) => (
            <div
              key={range}
              className="flex flex-col items-center rounded-xl border border-white/10 bg-[#1A1A1F] p-6 text-center transition-colors hover:border-[#FFFF00]/35"
            >
              <Lock size={32} className="text-white/45" />
              <p className="mt-4 text-sm text-white/70">{range}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto h-px w-full max-w-[1180px] bg-[#1a1a1f]" />

      <section className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col items-center justify-center px-6 py-32 text-center md:px-10">
        <LabelPill>BE FIRST</LabelPill>
        <h2 className="mt-6 text-5xl font-black tracking-tight sm:text-7xl">First to move wins.</h2>
        <p className="mt-4 max-w-2xl text-base text-white/60 sm:text-lg">
          The platform opens to the people who showed up early.
        </p>
        <div className="mt-6 w-full max-w-[760px]">
          <WaitlistForm />
        </div>
        <p className="mt-4 text-xs text-white/45">No spam. One email when we open the doors.</p>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-6 py-8 text-sm md:flex-row md:items-center md:justify-between md:px-10">
          <div className="flex items-center gap-3">
            <span className="h-5 w-[3px] bg-[#FFFF00]" />
            <span className="tracking-[0.12em] text-white/85">skillflow</span>
          </div>
          <p className="text-white/45">© 2026 Xmas Group</p>
        </div>
      </footer>
    </main>
  );
}
