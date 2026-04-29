"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import AppNavbar from "@/components/AppNavbar";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import LoadingRing from "@/components/LoadingRing";
import { usePlayMode } from "@/contexts/PlayModeContext";
import { useOnlinePlayers } from "@/hooks/useOnlinePlayers";
import { getCurrentUser } from "@/lib/api";

interface DisplayUser {
  user_metadata?: { username?: string };
  email?: string;
}

interface UpcomingLastTouchSession {
  id: string;
  scheduledStartAtMs: number;
  prizePool: number;
}

const GAMES = [
  { name: "Chess", slug: "chess", image: "/images/chess-card.png", active: true },
  { name: "Connect 4", slug: "connect-4", image: "/images/connect4-card.png", active: true },
  { name: "Reaction Duel", slug: "reaction-duel", image: "/images/reaction-duel-card.png", active: true },
  { name: "Memory Match", slug: "memory-match", image: "/images/memory-match-card.png", active: true },
  { name: "Checkers", slug: "checkers", image: "/images/checkers-card.png", active: true },
  { name: "Spelling Bee", slug: "spelling-bee", image: "/images/spelling-bee-card.png", active: true },
  { name: "Typing Race", slug: "typing-race", image: "/images/typing-race-card.png", active: true },
  { name: "Trivia", slug: "trivia", image: "/images/trivia-card.png", active: true },
];

function GameCard({
  name,
  slug,
  image,
  active,
  playersOnline,
  waitSec,
  isPractice,
}: {
  name: string;
  slug: string;
  image: string;
  active: boolean;
  playersOnline: number;
  waitSec: number;
  isPractice: boolean;
}) {
  const content = (
    <div
      className={`card-border group relative flex h-[260px] w-[170px] shrink-0 flex-col justify-between overflow-hidden rounded-card bg-card transition-all duration-200 md:h-[280px] md:w-full ${
        active
          ? isPractice
            ? "hover:-translate-y-0.5 hover:border-purple-500/40 hover:shadow-[0_0_26px_rgba(168,85,247,0.35)] cursor-pointer"
            : "hover:-translate-y-0.5 hover:border-steel-blue-bright hover:shadow-[0_0_26px_rgba(42,58,92,0.6)] cursor-pointer"
          : "cursor-not-allowed opacity-60"
      }`}
    >
      <Image
        src={image}
        alt={`${name} background`}
        fill
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-[40%] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      {!active && (
        <div className="absolute inset-0 rounded-card bg-black/40" />
      )}
      <div className="relative z-10 mt-auto p-4">
        <div className="space-y-1">
          <p className="text-lg font-bold text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.8)]">{name}</p>
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
        <div className="mt-2 space-y-1 text-xs text-slate-200">
          <p>{playersOnline} players online</p>
          <p>~{waitSec} sec avg wait</p>
        </div>
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
  const [lastTouchSession, setLastTouchSession] = useState<UpcomingLastTouchSession | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
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

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let active = true;
    async function loadUpcoming() {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("last_touch_sessions")
        .select("id, scheduled_start_at, prize_pool")
        .eq("status", "upcoming")
        .gte("scheduled_start_at", nowIso)
        .order("scheduled_start_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (!data?.id || !data.scheduled_start_at) {
        setLastTouchSession(null);
        return;
      }
      const scheduledStartAtMs = new Date(data.scheduled_start_at).getTime();
      if (!Number.isFinite(scheduledStartAtMs)) {
        setLastTouchSession(null);
        return;
      }
      setLastTouchSession({
        id: data.id,
        scheduledStartAtMs,
        prizePool: Number(data.prize_pool ?? 0),
      });
    }
    void loadUpcoming();
    const ch = supabase
      .channel("lt-play-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "last_touch_sessions" }, () => void loadUpcoming())
      .subscribe();
    return () => {
      active = false;
      ch.unsubscribe();
    };
  }, []);

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
    return <LoadingRing />;
  }

  const username = user?.user_metadata?.username || "Player";
  const ltCountdownSec = lastTouchSession == null ? null : Math.max(0, Math.ceil((lastTouchSession.scheduledStartAtMs - nowMs) / 1000));
  const ltMins = Math.floor((ltCountdownSec ?? 0) / 60);
  const ltSecs = (ltCountdownSec ?? 0) % 60;

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
        {!isPractice && lastTouchSession && (
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
            <div className="relative pr-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                  <p className="text-xl font-bold text-white">${(lastTouchSession?.prizePool ?? 0).toFixed(2)}</p>
                  <p className="text-xs text-body-gray">
                    Starts in {ltCountdownSec == null ? "—:—" : `${ltMins}:${ltSecs.toString().padStart(2, "0")}`}
                  </p>
                </div>
                <span className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-charcoal shadow-[0_0_20px_rgba(255,94,0,0.5)]">
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
        <div className="-mx-4 mt-8 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          <div className="flex gap-4 md:grid md:grid-cols-4">
            {(isPractice ? GAMES.filter((g) => g.active) : GAMES).map((game, i) => (
              <GameCard
                key={game.slug}
                name={game.name}
                slug={game.slug}
                image={game.image}
                active={game.active}
                playersOnline={onlineCount}
                waitSec={playersWait[i]?.wait ?? 15}
                isPractice={isPractice}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
