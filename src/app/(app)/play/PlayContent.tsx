"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import GameCardChallenges from "@/components/play/GameCardChallenges";
import LoadingRing from "@/components/LoadingRing";
import { useDailyChallenges } from "@/hooks/useDailyChallenges";
import { useGames, type GameCategory } from "@/hooks/useGames";
import { useGameOrder } from "@/hooks/useGameOrder";
import { useProfile } from "@/hooks/useProfile";
import { useRecentMatches } from "@/hooks/useRecentMatches";
import type { DailyChallengeRow } from "@/lib/daily-challenges";

const FILTERS: Array<{ label: string; value: "all" | GameCategory }> = [
  { label: "ALL", value: "all" },
  { label: "STRATEGY", value: "strategy" },
  { label: "REFLEX", value: "reflex" },
  { label: "KNOWLEDGE", value: "knowledge" },
];

// TODO: Replace with real presence query when profile heartbeat/current_game is available.
function fakeOnlineCount(slug: string, bucket: number): number {
  const seed = [...slug].reduce((acc, char) => acc + char.charCodeAt(0), 0) + bucket;
  return 80 + ((seed * 37) % 420);
}

function PlayGameCard({
  game,
  index,
  onlineCount,
  challenges,
}: {
  game: { slug: string; name: string; image: string; waitSeconds: number };
  index: number;
  onlineCount: number;
  challenges: DailyChallengeRow[];
}) {
  const [hovered, setHovered] = useState(false);
  const scopedChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.game_slug === game.slug || challenge.game_slug == null),
    [challenges, game.slug]
  );

  return (
    <Link
      href={`/play/${game.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="group relative block aspect-[2/3] overflow-hidden rounded-xl border border-[#1F1F26] bg-[#16161C] transition duration-150 hover:scale-[1.02] hover:border-[#FFFF00]"
    >
      <Image
        src={game.image}
        alt={`${game.name} artwork`}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
        priority={index < 2}
      />
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-[40%] bg-gradient-to-t from-black/80 via-black/45 to-transparent" />

      {index === 0 ? (
        <div className="absolute right-3 top-3 z-10 rounded-full bg-[#FFFF00] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black">
          HOT
        </div>
      ) : null}

      <GameCardChallenges challenges={scopedChallenges} visible={hovered} />

      <div className="absolute bottom-0 left-0 p-4">
        <p className="text-[20px] font-black text-white">{game.name}</p>
        <p className="mt-1 text-[13px] font-medium tracking-tight text-[#FFFF00]">
          {onlineCount.toLocaleString()} online
        </p>
        <p className="mt-1 text-xs font-normal text-[#9CA3AF]">~{game.waitSeconds}s wait</p>
      </div>
    </Link>
  );
}

export default function PlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<"all" | GameCategory>("all");
  const [onlineBucket, setOnlineBucket] = useState(Math.floor(Date.now() / (5 * 60 * 1000)));
  const { profile, loading } = useProfile();
  const { games } = useGames();
  const orderedGames = useGameOrder(games, profile.id || null);
  const { challenges } = useDailyChallenges(profile.id, 10);
  const { matches } = useRecentMatches({ limit: 1, username: profile.username });

  const openSpFromUrl = useMemo(() => searchParams.get("sp") === "1", [searchParams]);

  const filteredGames = useMemo(() => {
    if (activeFilter === "all") return orderedGames;
    return orderedGames.filter((game) => game.category === activeFilter);
  }, [activeFilter, orderedGames]);

  const onlineCountBySlug = useMemo(() => {
    return Object.fromEntries(
      orderedGames.map((game) => [game.slug, fakeOnlineCount(game.slug, onlineBucket)])
    ) as Record<string, number>;
  }, [orderedGames, onlineBucket]);

  useEffect(() => {
    if (!loading && !profile.id) {
      router.push("/login");
    }
  }, [loading, profile.id, router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setOnlineBucket(Math.floor(Date.now() / (5 * 60 * 1000)));
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  if (loading || !profile.id) {
    return <LoadingRing />;
  }

  return (
    <div className="min-h-screen bg-[#0E0E12] pb-24 text-white md:pb-8">
      <AppNavbar currentPage="play" initialOpenSpModal={openSpFromUrl} />

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-[32px] font-black tracking-[-0.03em] text-white">Pick a game. Match in 20 seconds.</h1>
        <p className="mt-2 text-sm text-[#9CA3AF]">Beta · Free to play · Earn SkillPoints</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.06em] transition-colors ${
                  active
                    ? "border-[#FFFF00] bg-[#FFFF00] text-black"
                    : "border-[#1F1F26] bg-[#16161C] text-[#9CA3AF] hover:text-white"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredGames.map((game, index) => (
            <PlayGameCard
              key={game.slug}
              game={game}
              index={index}
              onlineCount={onlineCountBySlug[game.slug] ?? 0}
              challenges={challenges}
            />
          ))}
        </div>

        <section className="mt-12">
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="inline-flex min-w-full gap-2 pb-1">
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-xs ${
                    challenge.completed
                      ? "border-[#1F1F26] bg-[#16161C] text-[#6B7280]"
                      : "border-[#1F1F26] bg-[#16161C] text-[#D1D5DB]"
                  }`}
                >
                  <span>{challenge.completed ? "✓" : "◉"}</span>
                  <span>{challenge.description}</span>
                  <span>{Number(challenge.progress)}/{Number(challenge.target)}</span>
                  <span className={challenge.completed ? "text-[#6B7280]" : "text-[#FFFF00]"}>
                    +{Number(challenge.reward_sp).toLocaleString()} SP
                  </span>
                </div>
              ))}
            </div>
          </div>

          {matches.length > 0 ? (
            <p className="mt-4 text-sm text-[#9CA3AF]">
              Last match: {matches[0].resultLabel} vs {matches[0].opponent} ·
              <span className="text-[#FFFF00]"> +{matches[0].spDelta} SP</span> · {matches[0].timeAgo}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
