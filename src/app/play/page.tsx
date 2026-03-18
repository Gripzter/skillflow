"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import AppNavbar from "@/components/AppNavbar";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import { usePlayMode } from "@/contexts/PlayModeContext";
import { useOnlinePlayers } from "@/hooks/useOnlinePlayers";
import { getCurrentUser } from "@/lib/api";

interface DisplayUser {
  user_metadata?: { username?: string };
  email?: string;
}

const GAMES = [
  { name: "Chess", slug: "chess", gradient: "from-amber-500/20 to-rose-500/20", active: true },
  { name: "Connect 4", slug: "connect-4", gradient: "from-red-500/30 to-amber-400/30", active: true },
  { name: "Reaction Duel", slug: "reaction-duel", gradient: "from-orange-500/30 to-red-500/30", active: true },
  { name: "Spelling Bee", slug: "spelling-bee", gradient: "from-amber-500/30 to-yellow-600/30", active: true },
  { name: "Memory Match", slug: "memory-match", gradient: "from-purple-500/40 via-pink-500/40 to-fuchsia-500/40", active: true },
  { name: "Checkers", slug: "checkers", gradient: "from-[#FF5E00]/25 to-[#2A3A5C]/25", active: true },
  { name: "Mini Golf", slug: "mini-golf", gradient: "from-emerald-500/20 to-teal/30", active: false },
  { name: "Darts", slug: "darts", gradient: "from-purple/20 to-pink-500/20", active: false },
  { name: "8 Ball Pool", slug: "8-ball-pool", gradient: "from-emerald-500/25 to-emerald-500/5", active: false },
];

function useRandom(min: number, max: number, seed: string): number {
  const [n, setN] = useState(min);
  useEffect(() => {
    setN(min + Math.floor(Math.random() * (max - min + 1)));
  }, [min, max, seed]);
  return n;
}

function GameCard({
  name,
  slug,
  gradient,
  active,
  playersOnline,
  waitSec,
  isPractice,
  emoji,
}: {
  name: string;
  slug: string;
  gradient: string;
  active: boolean;
  playersOnline: number;
  waitSec: number;
  isPractice: boolean;
  emoji?: string;
}) {
  const content = (
    <div
      className={`card-border relative flex min-h-[160px] flex-col justify-between overflow-hidden rounded-card bg-card transition-all duration-200 ${
        active
          ? isPractice
            ? "hover:-translate-y-0.5 hover:border-purple-500/40 hover:shadow-[0_0_26px_rgba(168,85,247,0.35)] cursor-pointer"
            : "hover:-translate-y-0.5 hover:border-steel-blue-bright hover:shadow-[0_0_26px_rgba(42,58,92,0.6)] cursor-pointer"
          : slug === "8-ball-pool"
            ? "pointer-events-none opacity-50"
            : "cursor-not-allowed opacity-60"
      }`}
    >
      {(slug === "chess" || slug === "connect-4" || slug === "reaction-duel" || slug === "spelling-bee" || slug === "8-ball-pool") && (
        <>
          <Image
            src={
              slug === "chess"
                ? "/games/chess.jpg"
                : slug === "connect-4"
                ? "/games/connect4.jpg"
                : slug === "reaction-duel"
                ? "/games/reaction.jpg"
                : slug === "spelling-bee"
                ? "/games/spelling.jpg"
                : "/games/pool.jpg"
            }
            alt={`${name} background`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-transparent lg:from-black/80 lg:via-black/50" />
        </>
      )}
      {!active && (
        <div className={`absolute inset-0 rounded-card bg-gradient-to-br ${gradient} opacity-40`} />
      )}
      <div className="relative z-10 p-5">
        <div>
          <p className="font-semibold text-white flex items-center gap-2">
            <span>{name}</span>
            {active && slug === "checkers" && emoji ? (
              <span className="text-[18px] leading-none">{emoji}</span>
            ) : null}
          </p>
          {active ? (
            <span
              className={`mt-2 inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isPractice ? "bg-purple-500/20 text-purple-300" : "bg-teal/20 text-teal"
              }`}
            >
              {isPractice ? "1v1 • Free" : "1v1"}
            </span>
          ) : (
            <span className="mt-2 inline-block w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-body-gray">
              Coming Soon
            </span>
          )}
        </div>
        <div className="mt-3 space-y-1 text-xs text-body-gray">
          <p>{playersOnline} players online</p>
          <p>~{waitSec} sec avg wait</p>
        </div>
      </div>
      {!active && slug !== "8-ball-pool" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="h-10 w-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      )}
      {!active && slug === "8-ball-pool" && (
        <div className="pointer-events-none absolute inset-0 flex items-start justify-end p-3">
          <span className="rounded-full bg-[#2A3A5C] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Coming Soon
          </span>
        </div>
      )}
      {active && slug === "checkers" && (
        <div className="relative z-10 mt-4 flex items-center justify-center px-5">
          <span className="rounded-lg border border-[#2A3A5C] bg-[#1A1A22]/20 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_22px_rgba(42,58,92,0.4)]">
            Play
          </span>
        </div>
      )}
    </div>
  );

  if (active) {
    return <Link href={`/play/${slug}`}>{content}</Link>;
  }
  return <div>{content}</div>;
}

export default function PlayPage() {
  const router = useRouter();
  const { isPractice } = usePlayMode();
  const [user, setUser] = useState<DisplayUser | null>(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [playersWait, setPlayersWait] = useState<{ players: number; wait: number }[]>([]);
  const onlineCount = useOnlinePlayers(userId);

  useEffect(() => {
    setPlayersWait(
      GAMES.map(() => ({
        players: 50 + Math.floor(Math.random() * 451),
        wait: 10 + Math.floor(Math.random() * 36),
      }))
    );
  }, []);

  useEffect(() => {
    async function getUser() {
      const current = await getCurrentUser();
      if (!current) {
        router.push("/login");
        setLoading(false);
        return;
      }
      setUserId(current.id);
      setUser({
        user_metadata: { username: current.username },
        email: current.email,
      });
      setIsDevMode(current.isDevMode ?? false);
      setLoading(false);
    }
    getUser();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("skillflow_dev_mode");
        localStorage.removeItem("skillflow_dev_user");
      }
      const supabase = createClient();
      if (supabase) await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <svg
          className={`h-10 w-10 animate-spin ${
            isPractice ? "text-purple-400" : "text-teal"
          }`}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  const username = user?.user_metadata?.username || "Player";

  return (
    <div className="min-h-screen bg-charcoal pb-20 md:pb-0">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="play"
      />
      <ModeToggleBarContent />
      <main className="relative mx-auto max-w-[1200px] px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pt-8 md:pb-12">
        {!isPractice && (
          <Link
            href="/last-touch"
            className="group relative mb-8 block overflow-hidden rounded-2xl border-2 border-steel-blue bg-black/40 p-6 shadow-[0_0_40px_rgba(42,58,92,0.4)] transition-all duration-300 hover:border-steel-blue-bright hover:shadow-[0_0_60px_rgba(42,58,92,0.6)]"
          >
            <Image
              src="/games/lasttouch.jpg"
              alt="Last Touch arena background"
              fill
              className="object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-transparent lg:from-black/80 lg:via-black/50" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="bg-gradient-to-r from-teal to-purple-500 bg-clip-text text-2xl font-black text-transparent">
                  LAST TOUCH
                </h2>
                <p className="mt-1 text-body-gray">Hold your ground. Win it all.</p>
                <p className="mt-2 text-sm text-teal">Massive prize pool • Last finger standing wins</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-body-gray">Prize Pool</p>
                  <p className="text-xl font-bold text-white">$1,247</p>
                </div>
                <span className="rounded-xl bg-teal px-5 py-2.5 font-semibold text-charcoal shadow-[0_0_20px_rgba(255,94,0,0.5)]">
                  Join Now
                </span>
              </div>
            </div>
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-teal/20 blur-2xl" />
          </Link>
        )}

        <h1 className="text-2xl font-bold text-white sm:text-3xl">Choose Your Game</h1>
        <p className="mt-1 text-body-gray">
          {isPractice ? "Select a game to play for free" : "Select a game and stake to find your opponent"}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {(isPractice ? GAMES.filter((g) => g.active || g.slug === "8-ball-pool") : GAMES).map((game, i) => (
            <GameCard
              key={game.slug}
              name={game.name}
              slug={game.slug}
              gradient={game.gradient}
              active={game.active}
              playersOnline={onlineCount}
              waitSec={playersWait[i]?.wait ?? 15}
              isPractice={isPractice}
              emoji={game.slug === "checkers" ? "⬛" : undefined}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
