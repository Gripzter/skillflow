"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import AppNavbar from "@/components/AppNavbar";
import { getCurrentUser, getWalletBalance, getMatches, logout as apiLogout } from "@/lib/api";

const GAMES = [
  { name: "8 Ball Pool", slug: "8-ball-pool", tag: "1v1", gradient: "from-teal/30 to-purple/30", comingSoon: false },
  { name: "Chess", slug: "chess", tag: "1v1", gradient: "from-amber-500/20 to-rose-500/20", comingSoon: false },
  { name: "Connect 4", slug: "connect-4", tag: "1v1", gradient: "from-red-500/30 to-amber-400/30", comingSoon: false },
  { name: "Mini Golf", slug: "mini-golf", tag: "Coming Soon", gradient: "from-emerald-500/20 to-teal/30", comingSoon: true },
  { name: "Reaction Duel", slug: "reaction-duel", tag: "1v1", gradient: "from-orange-500/30 to-red-500/30", comingSoon: false },
  { name: "Darts", slug: "darts", tag: "Coming Soon", gradient: "from-purple/20 to-pink-500/20", comingSoon: true },
  { name: "Card Clash", slug: "card-clash", tag: "Coming Soon", gradient: "from-rose-500/20 to-purple/20", comingSoon: true },
];

export default function DashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [username, setUsername] = useState<string>("Player");
  const [isDevMode, setIsDevMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [balance, setBalance] = useState(0);
  const [matches, setMatches] = useState<{ id: string; status: string; winner?: string }[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUsername(user.username);
        setIsDevMode(user.isDevMode ?? false);
        const [bal, matchList] = await Promise.all([getWalletBalance(), getMatches()]);
        setBalance(bal);
        setMatches(matchList);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiLogout();
      showToast("Logged out successfully", "success");
      router.push("/login");
      router.refresh();
    } catch {
      showToast("Something went wrong", "error");
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

  const completedMatches = matches.filter((m) => m.status === "completed");
  const wins = completedMatches.filter((m) => m.winner === "player1").length;
  const winRate = completedMatches.length ? Math.round((wins / completedMatches.length) * 100) : 0;
  const totalEarnings = balance; // simplified; could sum from transactions if needed

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="dashboard"
      />
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome banner */}
        <section className="animate-fade-in card-border rounded-card bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">
                Welcome back, {username}!
              </h1>
              <p className="mt-1 text-body-gray">Ready to compete?</p>
            </div>
            <div className="flex flex-wrap gap-6 border-t border-white/5 pt-4 sm:border-t-0 sm:border-l sm:border-white/5 sm:pt-0 sm:pl-6">
              <div>
                <p className="text-xs text-body-gray">Matches Played</p>
                <p className="text-lg font-semibold text-white">{matches.length}</p>
              </div>
              <div>
                <p className="text-xs text-body-gray">Win Rate</p>
                <p className="text-lg font-semibold text-white">{winRate}%</p>
              </div>
              <div>
                <p className="text-xs text-body-gray">Total Earnings</p>
                <p className="text-lg font-semibold text-white">${totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mt-8">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <Link
              href="/wallet"
              className="card-border group animate-fade-in rounded-card bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-teal-glow/20 "
            >
              <div className="h-1 w-12 rounded-full bg-teal" />
              <p className="mt-4 text-lg font-semibold text-white">💰 Deposit</p>
              <p className="mt-1 text-sm text-body-gray">Add funds to your wallet</p>
            </Link>
            <Link
              href="/play"
              className="card-border group animate-fade-in rounded-card bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-purple-glow/20 "
            >
              <div className="h-1 w-12 rounded-full bg-purple" />
              <p className="mt-4 text-lg font-semibold text-white">🎮 Quick Match</p>
              <p className="mt-1 text-sm text-body-gray">Find an opponent now</p>
            </Link>
            <Link
              href="/external"
              className="card-border group animate-fade-in rounded-card border-orange-500/30 bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10"
            >
              <div className="h-1 w-12 rounded-full bg-orange-500" />
              <p className="mt-4 text-lg font-semibold text-white">⚔️ Arena</p>
              <p className="mt-1 text-sm text-body-gray">Wager on CS2, Sim Racing & more</p>
            </Link>
            <Link
              href="/leaderboard"
              className="card-border group animate-fade-in rounded-card bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10 "
            >
              <div className="h-1 w-12 rounded-full bg-amber-500" />
              <p className="mt-4 text-lg font-semibold text-white">🏆 Leaderboard</p>
              <p className="mt-1 text-sm text-body-gray">See top players</p>
            </Link>
          </div>
        </section>

        {/* Available games */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white">Choose Your Game</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            {GAMES.map((game, i) => {
              const content = (
                <div
                  className={`card-border relative flex min-h-[120px] flex-col justify-between rounded-card bg-card p-5 transition-all duration-200 ${
                    game.comingSoon
                      ? "cursor-not-allowed opacity-60"
                      : "hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-teal-glow/10"
                  }`}
                >
                  <div className={`absolute inset-0 rounded-card bg-gradient-to-br ${game.gradient} opacity-40`} />
                  <div className="relative">
                    <p className="font-semibold text-white">{game.name}</p>
                    <span
                      className={`mt-2 inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        game.comingSoon ? "bg-white/10 text-body-gray" : "bg-teal/20 text-teal"
                      }`}
                    >
                      {game.tag}
                    </span>
                  </div>
                  {game.comingSoon ? (
                    <div className="relative mt-2 flex items-center gap-1.5 text-body-gray">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-xs">Coming soon</span>
                    </div>
                  ) : (
                    <p className="relative mt-2 text-xs font-medium text-teal opacity-0 transition-opacity group-hover:opacity-100">
                      Play Now →
                    </p>
                  )}
                </div>
              );
              return game.comingSoon ? (
                <div key={game.slug} className="animate-fade-in">
                  {content}
                </div>
              ) : (
                <Link key={game.slug} href={`/play/${game.slug}`} className="group animate-fade-in">
                  {content}
                </Link>
              );
            })}
          </div>

          <div className="mt-8 border-t border-white/10 pt-8">
            <h3 className="text-lg font-bold text-white">External Games</h3>
            <p className="mt-1 text-sm text-body-gray">Wager on real games. Play externally, win on SkillFlow.</p>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              <Link href="/external/cs2" className="group animate-fade-in">
                <div className="card-border relative flex min-h-[120px] flex-col justify-between rounded-card border-orange-500/20 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-500/40 hover:shadow-orange-500/10">
                  <div className="absolute inset-0 rounded-card bg-gradient-to-br from-blue-900/40 to-orange-600/40 opacity-60" />
                  <div className="relative">
                    <p className="font-semibold text-white">Counter-Strike 2</p>
                    <span className="mt-2 inline-block w-fit rounded-full bg-orange-500/20 px-2.5 py-0.5 text-xs font-medium text-orange-400">
                      Arena
                    </span>
                  </div>
                  <p className="relative mt-2 text-xs font-medium text-teal opacity-0 transition-opacity group-hover:opacity-100">
                    Wager on real CS2 →
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Recent matches */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white">Recent Matches</h2>
          <div className="card-border mt-4 flex min-h-[160px] flex-col items-center justify-center rounded-card bg-card py-12">
            {matches.length === 0 ? (
              <>
                <span className="text-4xl" aria-hidden>🎯</span>
                <p className="mt-3 text-body-gray">No matches yet. Play your first game!</p>
              </>
            ) : (
              <p className="text-body-gray">Last {Math.min(5, matches.length)} match(es) — see Profile for full history</p>
            )}
          </div>
        </section>

        {/* Live matches */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white">Live Now 🔴</h2>
          <div className="card-border mt-4 flex min-h-[100px] items-center justify-center rounded-card bg-card py-8">
            <p className="text-body-gray">No live matches right now</p>
          </div>
        </section>
      </main>
    </div>
  );
}
