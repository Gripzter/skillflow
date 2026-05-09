"use client";

import Image from "next/image";

type GameCard = {
  name: string;
  subtitle: string;
  slug: string;
  image: string;
};

const games: GameCard[] = [
  { name: "Chess", slug: "chess", image: "/images/chess-card.png", subtitle: "Classic 1v1, Glicko-2 ranked" },
  { name: "Connect 4", slug: "connect4", image: "/images/connect4-card.png", subtitle: "Speed-thinking grid duel" },
  { name: "Reaction Duel", slug: "reaction-duel", image: "/images/reaction-duel-card.png", subtitle: "Sub-200ms reflexes win" },
  { name: "Spelling Bee", slug: "spelling-bee", image: "/images/spelling-bee-card.png", subtitle: "500+ words, audio dictation" },
  { name: "Memory Match", slug: "memory-match", image: "/images/memory-match-card.png", subtitle: "6×6 grid, race to clear" },
  { name: "Checkers", slug: "checkers", image: "/images/checkers-card.png", subtitle: "Forced captures, kings, mind games" },
  { name: "Trivia", slug: "trivia", image: "/images/trivia-card.png", subtitle: "Speed knowledge duel" },
  { name: "Typing Race", slug: "typing-race", image: "/images/typing-race-card.png", subtitle: "Fastest fingers win" },
];

export default function GamesGrid() {
  return (
    <section id="games" className="border-t border-[#1a1a22]">
      <div className="mx-auto w-full max-w-[1200px] px-8 py-[60px]">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] uppercase tracking-[1.5px] text-[#FF5E00]">EIGHT GAMES</p>
            <h2 className="mt-2 text-[32px] font-medium tracking-[-1px] text-white">Pick your weapon</h2>
          </div>
          <p className="text-[13px] text-[#888]">All games — no luck, pure skill</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((game) => (
            <button
              key={game.slug}
              type="button"
              onClick={() => {
                window.location.href = `/games/${game.slug}`;
              }}
              className="rounded-[8px] border border-[#1a1a22] bg-[#13131a] p-4 text-left transition-all duration-150 hover:-translate-y-[2px] hover:border-[#2a2a35]"
            >
              <Image
                src={game.image}
                width={300}
                height={120}
                quality={85}
                alt={`${game.name} card`}
                className="mb-3 h-[120px] w-full rounded-[6px] object-cover"
              />
              <p className="text-[14px] font-medium text-white">{game.name}</p>
              <p className="mt-1 text-[11px] text-[#666]">{game.subtitle}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
