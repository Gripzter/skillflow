"use client";

import { useEffect, useMemo, useState } from "react";
import type { MouseEventHandler } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import GameCardChallenges from "@/components/play/GameCardChallenges";
import PromoCarousel from "@/components/play/PromoCarousel";
import { useDailyChallenges } from "@/hooks/useDailyChallenges";
import { useGames, type GameCategory } from "@/hooks/useGames";
import { useGameOrder } from "@/hooks/useGameOrder";
import { useProfile } from "@/hooks/useProfile";
import { useRecentMatches } from "@/hooks/useRecentMatches";
import type { DailyChallengeRow } from "@/lib/daily-challenges";
import { redirectToAuthAction } from "@/lib/auth-action";

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
  isAuthenticated,
}: {
  game: { slug: string; name: string; image: string; waitSeconds: number };
  index: number;
  onlineCount: number;
  challenges: DailyChallengeRow[];
  isAuthenticated: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const scopedChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.game_slug === game.slug || challenge.game_slug == null),
    [challenges, game.slug]
  );

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (isAuthenticated) return;
    event.preventDefault();
    redirectToAuthAction();
  };

  return (
    <Link
      href={`/play/${game.slug}`}
      onClick={handleClick}
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
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#FFFF00] text-black text-[9px] sm:text-[11px] font-bold uppercase tracking-wide rounded">
          HOT
        </div>
      ) : null}

      <GameCardChallenges challenges={scopedChallenges} visible={hovered} />

      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
        <h3 className="text-base sm:text-lg lg:text-xl font-black text-white mb-0.5 sm:mb-1 leading-tight">
          {game.name}
        </h3>
        <div className="text-[11px] sm:text-[13px] text-[#FFFF00] font-medium leading-tight">
          {onlineCount.toLocaleString()} online
        </div>
        <div className="text-[10px] sm:text-xs text-white/60 leading-tight">~{game.waitSeconds}s wait</div>
      </div>
    </Link>
  );
}

export default function PlayContent() {
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<"all" | GameCategory>("all");
  const [onlineBucket, setOnlineBucket] = useState(Math.floor(Date.now() / (5 * 60 * 1000)));
  const { profile, loading } = useProfile();
  const isAuthenticated = !!profile.id;
  const { games } = useGames();
  const orderedGames = useGameOrder(games, profile.id || null);
  const { challenges } = useDailyChallenges(isAuthenticated ? profile.id : "", 10);
  const { matches } = useRecentMatches({
    limit: 1,
    username: profile.username,
    enabled: isAuthenticated,
  });

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
    const interval = window.setInterval(() => {
      setOnlineBucket(Math.floor(Date.now() / (5 * 60 * 1000)));
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0E0E12] pb-24 text-white md:pb-8">
      <AppNavbar currentPage="play" initialOpenSpModal={isAuthenticated && !loading ? openSpFromUrl : false} />

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        <PromoCarousel isAuthenticated={isAuthenticated} />

        <h1 className="mt-8 text-[32px] font-black tracking-[-0.03em] text-white">
          Play smarter. Match faster. Earn more.
        </h1>
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

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {filteredGames.map((game, index) => (
            <PlayGameCard
              key={game.slug}
              game={game}
              index={index}
              onlineCount={onlineCountBySlug[game.slug] ?? 0}
              challenges={isAuthenticated ? challenges : []}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>

        <section className="mt-12">
          {isAuthenticated && matches.length > 0 ? (
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
