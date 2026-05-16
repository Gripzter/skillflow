"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import LoadingRing from "@/components/LoadingRing";
import { useDailyChallenges } from "@/hooks/useDailyChallenges";
import { useGames, type GameCategory } from "@/hooks/useGames";
import { useProfile } from "@/hooks/useProfile";
import { useRecentMatches } from "@/hooks/useRecentMatches";

const FILTERS: Array<{ label: string; value: "all" | GameCategory }> = [
  { label: "ALL", value: "all" },
  { label: "STRATEGY", value: "strategy" },
  { label: "REFLEX", value: "reflex" },
  { label: "KNOWLEDGE", value: "knowledge" },
];

export default function PlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<"all" | GameCategory>("all");
  const { profile, loading } = useProfile();
  const { games } = useGames();
  const { challenges } = useDailyChallenges(profile.id, 3);
  const { matches } = useRecentMatches({ limit: 1, username: profile.username });

  const openSpFromUrl = useMemo(() => searchParams.get("sp") === "1", [searchParams]);

  const filteredGames = useMemo(() => {
    if (activeFilter === "all") return games;
    return games.filter((game) => game.category === activeFilter);
  }, [activeFilter, games]);

  useEffect(() => {
    if (!loading && !profile.id) {
      router.push("/login");
    }
  }, [loading, profile.id, router]);

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
            <Link
              key={game.slug}
              href={`/play/${game.slug}`}
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
                <div className="absolute right-3 top-3 rounded-full bg-[#FFFF00] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black">
                  HOT
                </div>
              ) : null}

              <div className="absolute bottom-0 left-0 p-4">
                <p className="text-[20px] font-black text-white">{game.name}</p>
                <p className="mt-1 text-xs text-[#9CA3AF]">1v1</p>
                <p className="mt-1 text-xs font-semibold text-[#FFFF00]">~{game.waitSeconds}s wait</p>
              </div>
            </Link>
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
