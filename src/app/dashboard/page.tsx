"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import { useGeo } from "@/contexts/GeoContext";
import { usePlayMode } from "@/contexts/PlayModeContext";
import { getCurrentUser, getWalletBalance, getMatches, getPracticeMatches, getPracticeStats, logout as apiLogout } from "@/lib/api";

const GAMES = [
  { name: "8 Ball Pool", slug: "8-ball-pool", tag: "1v1", gradient: "from-teal/30 to-purple/30", comingSoon: false },
  { name: "Chess", slug: "chess", tag: "1v1", gradient: "from-amber-500/20 to-rose-500/20", comingSoon: false },
  { name: "Connect 4", slug: "connect-4", tag: "1v1", gradient: "from-red-500/30 to-amber-400/30", comingSoon: false },
  { name: "Memory Match", slug: "memory-match", tag: "Coming Soon", gradient: "from-purple-500/40 via-pink-500/40 to-fuchsia-500/40", comingSoon: true },
  { name: "Mini Golf", slug: "mini-golf", tag: "Coming Soon", gradient: "from-emerald-500/20 to-teal/30", comingSoon: true },
  { name: "Reaction Duel", slug: "reaction-duel", tag: "1v1", gradient: "from-orange-500/30 to-red-500/30", comingSoon: false },
  { name: "Spelling Bee", slug: "spelling-bee", tag: "1v1", gradient: "from-amber-500/30 to-yellow-600/30", comingSoon: false },
  { name: "Darts", slug: "darts", tag: "Coming Soon", gradient: "from-purple/20 to-pink-500/20", comingSoon: true },
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
  const [practiceStats, setPracticeStats] = useState({ practiceMatchesPlayed: 0, practiceWins: 0, practiceWinRate: 0 });
  const [rg, setRg] = useState<{
    cool_off_until: string | null;
    daily_deposit_limit: number | null;
    daily_deposited: number;
  } | null>(null);
  const [totalReferrals, setTotalReferrals] = useState<number | null>(null);
  const [referralBannerDismissed, setReferralBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("skillflow_referral_banner_dismissed") === "true";
  });
  const { isPractice } = usePlayMode();
  const { isRestricted } = useGeo();

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
        const [bal, matchList, rgRes, refCount] = await Promise.all([
          getWalletBalance(),
          getMatches(),
          (async () => {
            const { createClient } = await import("@/lib/supabase");
            const supabase = createClient();
            if (!supabase) return null;
            const { data } = await supabase
              .from("responsible_gaming")
              .select("cool_off_until, daily_deposit_limit, daily_deposited")
              .eq("user_id", user.id)
              .maybeSingle();
            return data;
          })(),
          (async () => {
            const { createClient } = await import("@/lib/supabase");
            const supabase = createClient();
            if (!supabase) return null;
            const { data } = await supabase
              .from("profiles")
              .select("total_referrals")
              .eq("id", user.id)
              .single();
            return data?.total_referrals ?? 0;
          })(),
        ]);
        setBalance(bal);
        setMatches(matchList);
        setRg(rgRes ?? null);
        setTotalReferrals(refCount ?? 0);
        const pStats = getPracticeStats(user.username);
        setPracticeStats(pStats);
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
    <div className="min-h-screen bg-charcoal pb-20 md:pb-0">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="dashboard"
      />
      <ModeToggleBarContent />
      <main className="mx-auto max-w-[1200px] px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pt-8 md:pb-12">
        {isRestricted && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            ⚠️ Real money play is not available in your region. Practice mode is available.
          </div>
        )}
        {rg?.cool_off_until && new Date(rg.cool_off_until) > new Date() && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            ⏸️ Cool-off period active. Real money play disabled.{" "}
            {(() => {
              const hours = Math.ceil((new Date(rg.cool_off_until!).getTime() - Date.now()) / (1000 * 60 * 60));
              const days = Math.floor(hours / 24);
              const h = hours % 24;
              return `${days > 0 ? `${days} day${days !== 1 ? "s" : ""}, ` : ""}${h} hour${h !== 1 ? "s" : ""} remaining.`;
            })()}{" "}
            Practice mode is available.
          </div>
        )}
        {rg?.daily_deposit_limit != null && !rg.cool_off_until && (
          (() => {
            const used = Number(rg.daily_deposited ?? 0);
            const limit = Number(rg.daily_deposit_limit);
            if (used > 0 && used >= limit * 0.8) {
              return (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
                  💡 You&apos;ve used ${used} of your ${limit} daily deposit limit.{" "}
                  <Link href="/settings/responsible-gaming" className="font-medium text-teal hover:underline">
                    Manage limits
                  </Link>
                </div>
              );
            }
            return null;
          })()
        )}
        {!referralBannerDismissed && (totalReferrals === null || totalReferrals === 0) && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-teal/30 bg-teal/5 px-4 py-3 text-sm text-teal-100">
            <span>
              🎁 Invite friends and earn $5 for each one!{" "}
              <Link href="/referrals" className="font-medium text-teal hover:underline">
                Share Your Link →
              </Link>
            </span>
            <button
              type="button"
              onClick={() => {
                setReferralBannerDismissed(true);
                if (typeof window !== "undefined") {
                  localStorage.setItem("skillflow_referral_banner_dismissed", "true");
                }
              }}
              className="shrink-0 rounded p-1 text-body-gray hover:text-white"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {/* Welcome banner */}
        <section className="welcome-banner animate-fade-in card-border rounded-card bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">
                Welcome back, {username}!
              </h1>
              <p className="mt-1 text-body-gray">
                {isPractice ? "Practice mode — sharpen your skills!" : "Ready to compete?"}
              </p>
            </div>
            <div className="flex flex-wrap gap-6 border-t border-white/5 pt-4 sm:border-t-0 sm:border-l sm:border-white/5 sm:pt-0 sm:pl-6">
              {isPractice ? (
                <>
                  <div>
                    <p className="stat-label text-xs text-body-gray">Practice Matches</p>
                    <p className="stat-number text-lg font-semibold text-white">{practiceStats.practiceMatchesPlayed}</p>
                  </div>
                  <div>
                    <p className="stat-label text-xs text-body-gray">Practice Win Rate</p>
                    <p className="stat-number text-lg font-semibold text-purple-400">{practiceStats.practiceWinRate}%</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="stat-label text-xs text-body-gray">Matches Played</p>
                    <p className="stat-number text-lg font-semibold text-white">{matches.length}</p>
                  </div>
                  <div>
                    <p className="stat-label text-xs text-body-gray">Win Rate</p>
                    <p className="stat-number text-lg font-semibold text-white">{winRate}%</p>
                  </div>
                  <div>
                    <p className="stat-label text-xs text-body-gray">Total Earnings</p>
                    <p className="stat-number text-lg font-semibold text-white">${totalEarnings.toFixed(2)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {!isPractice && (
          <>
            {/* Last Touch — featured event banner */}
            <section className="mt-8">
              <Link
                href="/last-touch"
                className="last-touch-banner group relative block overflow-hidden rounded-2xl border-2 border-teal/40 bg-gradient-to-br from-teal/10 via-purple-500/10 to-teal/10 p-6 shadow-[0_0_40px_rgba(0,229,199,0.1)] transition-all duration-300 hover:border-teal/60 hover:shadow-[0_0_60px_rgba(0,229,199,0.2)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-teal/5 to-purple-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="title bg-gradient-to-r from-teal to-purple-500 bg-clip-text text-2xl font-black text-transparent">
                      LAST TOUCH
                    </h2>
                    <p className="mt-1 text-body-gray">Hold your ground. Win it all.</p>
                    <p className="mt-2 text-sm text-teal">Next game in: 14:32 • Prize pool grows in real time</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-body-gray">Prize Pool</p>
                      <p className="text-xl font-bold text-white">$1,247</p>
                    </div>
                    <span className="join-btn rounded-xl bg-teal px-5 py-2.5 font-semibold text-charcoal shadow-[0_0_20px_rgba(0,229,199,0.4)]">
                      Join Now
                    </span>
                  </div>
                </div>
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-teal/20 blur-2xl" />
              </Link>
            </section>

            {/* Quick actions */}
            <section className="mt-8">
              <div className="-mx-4 flex gap-3 overflow-x-auto pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 md:grid-cols-4">
                {!isRestricted && (
                  <>
                    <Link
                      href="/wallet"
                      className="action-card pressable card-border group ml-4 inline-flex min-w-[200px] max-w-[260px] flex-1 animate-fade-in rounded-card bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-teal-glow/20 sm:ml-0"
                    >
                      <div className="top-accent h-1 w-12 rounded-full bg-teal" />
                      <p className="mt-4 text-lg font-semibold text-white">💰 Deposit</p>
                      <p className="mt-1 text-sm text-body-gray">Add funds to your wallet</p>
                    </Link>
                    <Link
                      href="/play"
                      className="action-card pressable card-border group inline-flex min-w-[200px] max-w-[260px] flex-1 animate-fade-in rounded-card bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-purple-glow/20"
                    >
                      <div className="top-accent h-1 w-12 rounded-full bg-purple" />
                      <p className="mt-4 text-lg font-semibold text-white">🎮 Quick Match</p>
                      <p className="mt-1 text-sm text-body-gray">Find an opponent now</p>
                    </Link>
                  </>
                )}
                <Link
                  href="/external"
                  className="action-card pressable card-border group inline-flex min-w-[200px] max-w-[260px] flex-1 animate-fade-in rounded-card border-orange-500/30 bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10"
                >
                  <div className="top-accent h-1 w-12 rounded-full bg-orange-500" />
                  <p className="mt-4 text-lg font-semibold text-white">⚔️ Arena</p>
                  <p className="mt-1 text-sm text-body-gray">Wager on CS2, Sim Racing & more</p>
                </Link>
                <Link
                  href="/leaderboard"
                  className="action-card pressable card-border group mr-4 inline-flex min-w-[200px] max-w-[260px] flex-1 animate-fade-in rounded-card bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10 sm:mr-0"
                >
                  <div className="top-accent h-1 w-12 rounded-full bg-amber-500" />
                  <p className="mt-4 text-lg font-semibold text-white">🏆 Leaderboard</p>
                  <p className="mt-1 text-sm text-body-gray">See top players</p>
                </Link>
              </div>
            </section>
          </>
        )}

        {/* Available games */}
        <section className={isPractice ? "mt-8" : "mt-10"}>
          <h2 className="section-title text-xl font-bold text-white">Choose Your Game</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            {(isPractice
              ? GAMES.filter(
                  (g) => !g.comingSoon && ["8-ball-pool", "chess", "connect-4", "reaction-duel", "spelling-bee"].includes(g.slug)
                )
              : GAMES
            ).map((game, i) => {
              const tagLabel = game.comingSoon
                ? game.tag
                : isPractice
                  ? "1v1 • Free Play"
                  : "1v1 • $1–$100 stakes";
              const accentClass = game.comingSoon
                ? "bg-white/10 text-body-gray"
                : isPractice
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-teal/20 text-teal";
              const hoverBorder = game.comingSoon ? "" : isPractice ? "hover:border-purple-500/30 hover:shadow-purple-500/10" : "hover:border-teal/30 hover:shadow-teal-glow/10";
              const content = (
                <div
                  className={`game-card card-border relative flex min-h-[120px] flex-col justify-between rounded-card bg-card p-5 transition-all duration-200 ${
                    game.comingSoon
                      ? "cursor-not-allowed opacity-60"
                      : `hover:-translate-y-0.5 ${hoverBorder}`
                  }`}
                >
                  <div className={`absolute inset-0 rounded-card bg-gradient-to-br ${game.gradient} opacity-40`} />
                  <div className="relative">
                    <p className="font-semibold text-white">{game.name}</p>
                    <span
                      className={`mt-2 inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${accentClass}`}
                    >
                      {tagLabel}
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
                    <p className={`relative mt-2 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 ${isPractice ? "text-purple-400" : "text-teal"}`}>
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

          {!isPractice && (
            <div className="mt-8 border-t border-white/10 pt-8">
              <h3 className="section-title text-lg font-bold text-white">External Games</h3>
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
          )}
        </section>

        {!isPractice && (
          <>
        {/* Recent matches */}
        <section className="mt-10">
          <h2 className="section-title text-xl font-bold text-white">Recent Matches</h2>
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
          <h2 className="section-title text-xl font-bold text-white">Live Now 🔴</h2>
          <div className="card-border mt-4 flex min-h-[100px] items-center justify-center rounded-card bg-card py-8">
            <p className="text-body-gray">No live matches right now</p>
          </div>
        </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
