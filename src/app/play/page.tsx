"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AppNavbar from "@/components/AppNavbar";

interface DisplayUser {
  user_metadata?: { username?: string };
  email?: string;
}

const GAMES = [
  { name: "8 Ball Pool", slug: "8-ball-pool", gradient: "from-teal/30 to-purple/30", active: true },
  { name: "Chess", slug: "chess", gradient: "from-amber-500/20 to-rose-500/20", active: true },
  { name: "Connect 4", slug: "connect-4", gradient: "from-red-500/30 to-amber-400/30", active: true },
  { name: "Mini Golf", slug: "mini-golf", gradient: "from-emerald-500/20 to-teal/30", active: false },
  { name: "Reaction Duel", slug: "reaction-duel", gradient: "from-orange-500/30 to-red-500/30", active: true },
  { name: "Darts", slug: "darts", gradient: "from-purple/20 to-pink-500/20", active: false },
  { name: "Card Clash", slug: "card-clash", gradient: "from-rose-500/20 to-purple/20", active: false },
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
}: {
  name: string;
  slug: string;
  gradient: string;
  active: boolean;
  playersOnline: number;
  waitSec: number;
}) {
  const content = (
    <div
      className={`card-border relative flex min-h-[160px] flex-col justify-between rounded-card bg-card p-5 transition-all duration-200 ${
        active
          ? "hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-teal-glow/10 cursor-pointer"
          : "cursor-not-allowed opacity-60"
      }`}
    >
      <div className={`absolute inset-0 rounded-card bg-gradient-to-br ${gradient} opacity-40`} />
      <div className="relative">
        <p className="font-semibold text-white">{name}</p>
        {active ? (
          <span className="mt-2 inline-block w-fit rounded-full bg-teal/20 px-2.5 py-0.5 text-xs font-medium text-teal">
            1v1
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
  const [user, setUser] = useState<DisplayUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [playersWait, setPlayersWait] = useState<{ players: number; wait: number }[]>([]);

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
      if (typeof window !== "undefined" && localStorage.getItem("skillflow_dev_mode") === "true") {
        try {
          const raw = localStorage.getItem("skillflow_dev_user");
          if (raw) {
            const devUser = JSON.parse(raw) as { username: string; email: string; role: string };
            setUser({
              user_metadata: { username: devUser.username },
              email: devUser.email,
            });
            setIsDevMode(true);
            setLoading(false);
            return;
          }
        } catch {
          // fall through
        }
      }
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        router.push("/login");
        return;
      }
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
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
        <svg className="h-10 w-10 animate-spin text-teal" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  const username = user?.user_metadata?.username || "Player";

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="play"
      />
      <main className="relative mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Choose Your Game</h1>
        <p className="mt-1 text-body-gray">Select a game and stake to find your opponent</p>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {GAMES.map((game, i) => (
            <GameCard
              key={game.slug}
              name={game.name}
              slug={game.slug}
              gradient={game.gradient}
              active={game.active}
              playersOnline={playersWait[i]?.players ?? 100}
              waitSec={playersWait[i]?.wait ?? 15}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
