"use client";

type GameCard = {
  name: string;
  icon: string;
  subtitle: string;
  slug: string;
  accent?: boolean;
};

const games: GameCard[] = [
  { name: "Chess", icon: "♟", subtitle: "Classic 1v1, Glicko-2 ranked", slug: "chess" },
  { name: "Connect 4", icon: "●", subtitle: "Speed-thinking grid duel", slug: "connect-4" },
  { name: "Reaction Duel", icon: "⚡", subtitle: "Sub-200ms reflexes win", slug: "reaction-duel", accent: true },
  { name: "Spelling Bee", icon: "⌨", subtitle: "500+ words, audio dictation", slug: "spelling-bee" },
  { name: "Memory Match", icon: "▦", subtitle: "6×6 grid, race to clear", slug: "memory-match" },
  { name: "Checkers", icon: "◐", subtitle: "Forced captures, kings, mind games", slug: "checkers" },
];

export default function GamesGrid() {
  return (
    <section id="games" className="border-t border-[#1a1a22]">
      <div className="mx-auto w-full max-w-[1200px] px-8 py-[60px]">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] uppercase tracking-[1.5px] text-[#FF5E00]">SIX GAMES</p>
            <h2 className="mt-2 text-[32px] font-medium tracking-[-1px] text-white">Pick your weapon</h2>
          </div>
          <p className="text-[13px] text-[#888]">All games — no luck, pure skill</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <button
              key={game.slug}
              type="button"
              onClick={() => {
                window.location.href = `/games/${game.slug}`;
              }}
              className="rounded-[8px] border border-[#1a1a22] bg-[#13131a] p-[18px] text-left transition-colors duration-150 hover:border-[#2a2a35]"
            >
              <p className={`mb-2.5 text-[24px] ${game.accent ? "text-[#FF5E00]" : "text-white"}`}>{game.icon}</p>
              <p className="text-[14px] font-medium text-white">{game.name}</p>
              <p className="mt-1 text-[11px] text-[#666]">{game.subtitle}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
