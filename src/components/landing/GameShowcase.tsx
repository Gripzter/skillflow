"use client";

import Link from "next/link";

const GAMES = [
  { emoji: "🎱", name: "8 Ball Pool", desc: "Sink the 8-ball to win", stakes: "$1 – $100", duration: "2–5 min", href: "/play/8-ball-pool" },
  { emoji: "♟️", name: "Chess", desc: "Checkmate for the pot", stakes: "$1 – $100", duration: "5–15 min", href: "/play/chess" },
  { emoji: "🔴", name: "Connect 4", desc: "Four in a row wins", stakes: "$1 – $100", duration: "2–5 min", href: "/play/connect-4" },
  { emoji: "⚡", name: "Reaction Duel", desc: "Fastest reflex wins", stakes: "$1 – $100", duration: "1–2 min", href: "/play/reaction-duel" },
  { emoji: "🐝", name: "Spelling Bee", desc: "Spell to win", stakes: "$1 – $100", duration: "3–8 min", href: "/play/spelling-bee" },
];

export default function GameShowcase() {
  return (
    <section id="games" className="scroll-mt-20 border-t border-white/5 bg-[#0A0E17] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">Choose Your Arena</h2>
        <p className="mt-2 text-center text-body-gray">5 skill-based games. Real opponents. Real stakes.</p>

        <div className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-2 md:snap-none lg:grid-cols-3 xl:grid-cols-5">
          {GAMES.map((game) => (
            <Link
              key={game.href}
              href={game.href}
              className="group flex min-w-[280px] snap-center flex-col rounded-xl border border-white/10 bg-card/80 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-teal/40 hover:shadow-[0_0_24px_rgba(0,229,199,0.12)] md:min-w-0"
            >
              <span className="text-4xl" aria-hidden>{game.emoji}</span>
              <h3 className="mt-3 text-lg font-bold text-white">{game.name}</h3>
              <p className="mt-1 text-sm text-body-gray">&quot;{game.desc}&quot;</p>
              <p className="mt-4 text-xs text-body-gray">Stakes: {game.stakes}</p>
              <p className="text-xs text-body-gray">⚡ {game.duration} matches</p>
              <span className="mt-4 text-teal font-medium group-hover:underline">
                Play Now →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
