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

const SIGNUP_URL = "/signup";

function handleCardClick() {
  window.location.href = SIGNUP_URL;
}

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

        <div className="grid grid-cols-2 gap-[14px] md:grid-cols-3 xl:grid-cols-4">
          {games.map((game, index) => (
            <button
              key={game.slug}
              type="button"
              onClick={handleCardClick}
              className="group cursor-pointer overflow-hidden rounded-[12px] border border-[#1a1a22] bg-[#13131a] p-0 text-left transition-all duration-200 ease-out hover:scale-[1.02] hover:border-[#2a2a35]"
            >
              <div className="relative aspect-[2/3] w-full bg-[#13131a]">
                <Image
                  src={game.image}
                  width={1024}
                  height={1536}
                  quality={90}
                  priority={index < 4}
                  alt={game.name}
                  sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 300px"
                  className="h-full w-full object-cover object-center transition-transform duration-200 ease-out group-hover:scale-[1.05]"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center",
                    display: "block",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(14,14,18,0.95)_0%,rgba(14,14,18,0.7)_60%,transparent_100%)] px-[14px] pb-[14px] pt-4">
                  <p className="mb-1 text-[15px] font-medium text-white">{game.name}</p>
                  <p className="text-[11px] text-[#aaa]">{game.subtitle}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
