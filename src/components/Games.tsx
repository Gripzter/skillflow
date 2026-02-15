"use client";

const games = [
  { name: "8 Ball Pool", tag: "1v1", gradient: "from-teal/30 to-purple/30" },
  { name: "Chess", tag: "1v1", gradient: "from-amber-500/20 to-rose-500/20" },
  {
    name: "Mini Golf",
    tag: "Coming Soon",
    gradient: "from-emerald-500/20 to-teal/30",
  },
  {
    name: "Penalty Shootout",
    tag: "Coming Soon",
    gradient: "from-green-500/20 to-emerald-500/20",
  },
  { name: "Darts", tag: "Coming Soon", gradient: "from-purple/20 to-pink-500/20" },
  {
    name: "Card Clash",
    tag: "Coming Soon",
    gradient: "from-rose-500/20 to-purple/20",
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
              key={game.name}
              className={`card-border rounded-card bg-gradient-to-br ${game.gradient} flex min-h-[140px] flex-col justify-between border bg-card p-6 transition-all duration-300 hover:scale-[1.02] hover:border-teal/30 hover:shadow-teal-glow/20`}
            >
              <span className="text-lg font-semibold">{game.name}</span>
              <span className="mt-2 inline-block w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-body-gray">
                {game.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
