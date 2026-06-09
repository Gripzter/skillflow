"use client";

type GameCategory = "strategy" | "reflex" | "knowledge";

type Game = {
  name: string;
  description: string;
  icon: string;
  status: "active" | "coming_soon";
  slug: string;
  category: GameCategory;
  gradient: string;
};

const games: Game[] = [
  {
    name: "8 Ball Pool",
    description: "Sink the 8. Call your pocket. Pure skill on the felt.",
    icon: "🎱",
    status: "coming_soon",
    slug: "8-ball-pool",
    category: "reflex",
    gradient: "from-teal/30 to-purple/30",
  },
  {
    name: "Chess",
    description: "Classic 1v1 strategy. Outthink your opponent.",
    icon: "♟️",
    status: "active",
    slug: "chess",
    category: "strategy",
    gradient: "from-amber-500/20 to-rose-500/20",
  },
  {
    name: "Connect 4",
    description: "Speed-thinking grid duel. Four in a row wins.",
    icon: "🔴",
    status: "active",
    slug: "connect-4",
    category: "strategy",
    gradient: "from-red-500/30 to-amber-400/30",
  },
  {
    name: "Checkers",
    description: "Forced captures, kings, and mind games.",
    icon: "⬛",
    status: "active",
    slug: "checkers",
    category: "strategy",
    gradient: "from-slate-500/20 to-zinc-500/30",
  },
  {
    name: "Reaction Duel",
    description: "Sub-200ms reflexes win the pot.",
    icon: "⚡",
    status: "active",
    slug: "reaction-duel",
    category: "reflex",
    gradient: "from-yellow-500/30 to-red-500/30",
  },
  {
    name: "Mini Golf",
    description: "Precision putting under pressure.",
    icon: "⛳",
    status: "coming_soon",
    slug: "mini-golf",
    category: "reflex",
    gradient: "from-emerald-500/20 to-teal/30",
  },
  {
    name: "Darts",
    description: "Hit the bullseye before they do.",
    icon: "🎯",
    status: "coming_soon",
    slug: "darts",
    category: "reflex",
    gradient: "from-purple/20 to-pink-500/20",
  },
  {
    name: "Card Clash",
    description: "High-stakes card battles coming soon.",
    icon: "🃏",
    status: "coming_soon",
    slug: "card-clash",
    category: "strategy",
    gradient: "from-rose-500/20 to-purple/20",
  },
  {
    name: "Deadlock",
    description: "Crack the code faster than your opponent. Pure logic, zero luck.",
    icon: "🔐",
    status: "coming_soon",
    slug: "deadlock",
    category: "strategy",
    gradient: "from-orange-500/20 to-red-500/30",
  },
  {
    name: "Chromo",
    description: "Memorize the color. Recreate it perfectly. Your eyes vs theirs.",
    icon: "🎨",
    status: "coming_soon",
    slug: "chromo",
    category: "reflex",
    gradient: "from-violet-500/20 to-fuchsia-500/30",
  },
];

export default function Games() {
  return (
    <section id="games" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">Games</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-body-gray">
          Skill-based. Competitive. Addictive.
        </p>
        <div className="mt-14 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
          {games.map((game) => (
            <div
              key={game.slug}
              className={`card-border rounded-card bg-gradient-to-br ${game.gradient} relative flex min-h-[160px] flex-col justify-between border bg-card p-6 transition-all duration-300 hover:scale-[1.02] hover:border-teal/30 hover:shadow-teal-glow/20`}
            >
              <div>
                <span className="text-2xl" aria-hidden>
                  {game.icon}
                </span>
                <span className="mt-2 block text-lg font-semibold">{game.name}</span>
                <p className="mt-1 text-xs text-body-gray">{game.description}</p>
              </div>
              <span
                className={`mt-3 inline-block w-fit rounded-full px-3 py-1 text-xs font-medium ${
                  game.status === "coming_soon"
                    ? "bg-white/10 text-body-gray"
                    : "bg-[#FFFF00]/15 text-[#FFFF00]"
                }`}
              >
                {game.status === "coming_soon" ? "Coming Soon" : "1v1"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
