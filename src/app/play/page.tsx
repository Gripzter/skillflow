"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  { name: "8 Ball Pool", slug: "8-ball-pool", gradient: "from-teal/30 to-purple/30", active: true },
  { name: "Chess", slug: "chess", gradient: "from-amber-500/20 to-rose-500/20", active: true },
  { name: "Connect 4", slug: "connect-4", gradient: "from-red-500/30 to-amber-400/30", active: true },
  { name: "Memory Match", slug: "memory-match", gradient: "from-purple-500/40 via-pink-500/40 to-fuchsia-500/40", active: false },
  { name: "Reaction Duel", slug: "reaction-duel", gradient: "from-orange-500/30 to-red-500/30", active: true },
  { name: "Spelling Bee", slug: "spelling-bee", gradient: "from-amber-500/30 to-yellow-600/30", active: true },
  { name: "Mini Golf", slug: "mini-golf", gradient: "from-emerald-500/20 to-teal/30", active: false },
  { name: "Darts", slug: "darts", gradient: "from-purple/20 to-pink-500/20", active: false },
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
}: {
  name: string;
  slug: string;
  gradient: string;
  active: boolean;
  playersOnline: number;
  waitSec: number;
  isPractice: boolean;
}) {
  const content = (
    <div
      className={`card-border relative flex min-h-[160px] flex-col justify-between rounded-card bg-card p-5 transition-all duration-200 ${
        active
          ? isPractice
            ? "hover:-translate-y-0.5 hover:border-purple-500/30 hover:shadow-purple-500/10 cursor-pointer"
            : "hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-teal-glow/10 cursor-pointer"
          : "cursor-not-allowed opacity-60"
      }`}
    >
      <div className={`absolute inset-0 rounded-card bg-gradient-to-br ${gradient} opacity-40`} />
      <div className="relative">
        <p className="font-semibold text-white">{name}</p>
        {active ? (
          <span className={`mt-2 inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${isPractice ? "bg-purple-500/20 text-purple-400" : "bg-teal/20 text-teal"}`}>
            {isPractice ? "1v1 • Free" : "1v1"}
          </span>
        ) : (
          <span className="mt-2 inline-block w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-body-gray">
            Coming Soon
          </span>
        )}
      </div>
      <div className="relative mt-2 space-y-1 text-xs text-body-gray">
        <p>{playersOnline} players online</p>
        <p>~{waitSec} sec avg wait</p>
      </div>
      {!active && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="h-10 w-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
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
            className="group relative mb-8 block overflow-hidden rounded-2xl border-2 border-teal/40 bg-gradient-to-br from-teal/10 via-purple-500/10 to-teal/10 p-6 shadow-[0_0_40px_rgba(0,229,199,0.1)] transition-all duration-300 hover:border-teal/60 hover:shadow-[0_0_60px_rgba(0,229,199,0.2)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-teal/5 to-purple-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
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
                <span className="rounded-xl bg-teal px-5 py-2.5 font-semibold text-charcoal shadow-[0_0_20px_rgba(0,229,199,0.4)]">
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
          {(isPractice
            ? GAMES.filter((g) => g.active && ["8-ball-pool", "chess", "connect-4", "reaction-duel", "spelling-bee"].includes(g.slug))
            : GAMES
          ).map((game, i) => (
            <GameCard
              key={game.slug}
              name={game.name}
              slug={game.slug}
              gradient={game.gradient}
              active={game.active}
              playersOnline={onlineCount}
              waitSec={playersWait[i]?.wait ?? 15}
              isPractice={isPractice}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
