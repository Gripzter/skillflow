"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import LoadingRing from "@/components/LoadingRing";
import RankBadge from "@/components/RankBadge";
import SPIcon from "@/components/SPIcon";
import { usePlayMode } from "@/contexts/PlayModeContext";
import { getCurrentUser, getLeaderboard, getPracticeMatches, logout as apiLogout } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import {
  sortAndRankPlayers,
  getMainStat,
  getSecondaryStat,
  type LeaderboardPlayer,
  type LeaderboardTab,
} from "@/lib/leaderboard-data";
import { buildLeaderboard, getTopGameEmoji } from "@/lib/leaderboard-seeding";
import { IS_SWEEPSTAKES_LAUNCH } from "@/constants/economy";
import { formatCurrency } from "@/lib/formatCurrency";

const TABS: { id: LeaderboardTab; label: string }[] = [
  { id: "skillpoints", label: "SkillPoints" },
  { id: "earnings", label: "Top Earners" },
  { id: "matches", label: "Most Matches" },
  { id: "winRate", label: "Highest Win Rate" },
  { id: "rating", label: "Skill Rating" },
];
const PAGE_SIZE = 20;

export default function LeaderboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string>("Player");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const [rawPlayers, setRawPlayers] = useState<LeaderboardPlayer[]>([]);
  const [practicePlayers, setPracticePlayers] = useState<LeaderboardPlayer[]>([]);
  const [playersByTab, setPlayersByTab] = useState<Partial<Record<LeaderboardTab, LeaderboardPlayer[]>>>({});
  const playersByTabRef = useRef<Partial<Record<LeaderboardTab, LeaderboardPlayer[]>>>({});
  const [displayedRealPlayers, setDisplayedRealPlayers] = useState<LeaderboardPlayer[]>([]);
  const [isTabRevalidating, setIsTabRevalidating] = useState(false);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("skillpoints");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { isPractice } = usePlayMode();

  const fetchRankedPlayersForTab = useCallback(async (tab: LeaderboardTab, currentUser: { id: string; username: string }) => {
    if (tab === "skillpoints") {
      const supabase = createClient();
      if (!supabase) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, username, lifetime_sp, rank_tier")
        .order("lifetime_sp", { ascending: false })
        .limit(100);

      const players: LeaderboardPlayer[] = (data ?? []).map((player) => ({
        id: player.id,
        username: player.username ?? "Player",
        avatarGradient: "from-teal/40 to-purple/40",
        skillRating: 1000,
        totalMatches: 0,
        winRate: 0,
        totalEarnings: 0,
        lifetimeSp: Number(player.lifetime_sp ?? 0),
        rankTier: player.rank_tier ?? "bronze",
        trend: "up",
        isCurrentUser: player.id === currentUser.id,
      }));
      return sortAndRankPlayers(players, tab);
    }

    const sortBy = tab === "rating" ? "skill_rating" : "total_earnings";
    const apiPlayers = await getLeaderboard(sortBy);
    const basePlayers: LeaderboardPlayer[] =
      apiPlayers?.map((p) => ({
        ...p,
        isCurrentUser: p.id === currentUser.id,
      })) ?? [];
    return sortAndRankPlayers(buildLeaderboard(basePlayers), tab);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setCurrentUserId(user.id);
        setUsername(user.username);
        setIsDevMode(user.isDevMode ?? false);
        const ranked = await fetchRankedPlayersForTab("skillpoints", { id: user.id, username: user.username });
        setRawPlayers(ranked);
        setDisplayedRealPlayers(ranked);
        const initialByTab: Partial<Record<LeaderboardTab, LeaderboardPlayer[]>> = { skillpoints: ranked };
        playersByTabRef.current = initialByTab;
        setPlayersByTab(initialByTab);
        const practice = getPracticeMatches();
        const byUser: Record<string, { wins: number; matches: number }> = {};
        practice.filter((m) => m.status === "completed").forEach((m) => {
          const u = m.player1.username;
          if (!byUser[u]) byUser[u] = { wins: 0, matches: 0 };
          byUser[u].matches++;
          if (m.winner === "player1") byUser[u].wins++;
        });
        const list: LeaderboardPlayer[] = Object.entries(byUser)
          .map(([username, s]) => ({
            id: username,
            username,
            avatarGradient: "from-purple-500/40 to-pink-500/40",
            skillRating: 1000,
            totalMatches: s.matches,
            // Store practice win rate as a numeric percentage with one decimal place
            winRate: s.matches ? Math.round((s.wins / s.matches) * 1000) / 10 : 0,
            totalEarnings: 0,
            trend: "up",
            isCurrentUser: username === user.username,
          }))
          .sort((a, b) => b.totalMatches - a.totalMatches)
          .slice(0, 50);
        setPracticePlayers(list);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, fetchRankedPlayersForTab]);

  const sortedPractice = useMemo(
    () => [...practicePlayers].sort((a, b) => b.totalMatches - a.totalMatches),
    [practicePlayers]
  );

  useEffect(() => {
    if (loading || isPractice || !username) return;
    let cancelled = false;
    const cached = playersByTabRef.current[activeTab];
    if (cached && cached.length > 0) {
      setDisplayedRealPlayers(cached);
    }
    setIsTabRevalidating(true);
    void fetchRankedPlayersForTab(activeTab, { id: currentUserId, username })
      .then((fresh) => {
        if (cancelled) return;
        setRawPlayers(fresh);
        setDisplayedRealPlayers(fresh);
        setPlayersByTab((prev) => {
          const next = { ...prev, [activeTab]: fresh };
          playersByTabRef.current = next;
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsTabRevalidating(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, currentUserId, fetchRankedPlayersForTab, isPractice, loading, username]);

  const filteredPlayers = useMemo(() => {
    const source = isPractice ? sortedPractice : displayedRealPlayers;
    if (!search.trim()) return source;
    const q = search.trim().toLowerCase();
    return source.filter((p) => p.username.toLowerCase().includes(q));
  }, [displayedRealPlayers, sortedPractice, search, isPractice]);

  const showPodium = isPractice || activeTab !== "skillpoints";
  const podium = showPodium ? filteredPlayers.slice(0, 3) : [];
  const tablePlayers = showPodium ? filteredPlayers.slice(3) : filteredPlayers;
  const visibleCount = page * PAGE_SIZE;
  const visiblePlayers = tablePlayers.slice(0, visibleCount);
  const hasMore = visibleCount < tablePlayers.length;

  const currentUserRank = useMemo(() => {
    const idx = filteredPlayers.findIndex((p) => p.isCurrentUser);
    return idx >= 0 ? idx + 1 : null;
  }, [filteredPlayers]);

  const currentUserPlayer = useMemo(
    () => filteredPlayers.find((p) => p.isCurrentUser),
    [filteredPlayers]
  );

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiLogout();
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return <LoadingRing />;
  }

  return (
    <div className="min-h-screen bg-charcoal pb-24 md:pb-0">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="leaderboard"
      />
      <ModeToggleBarContent />

      <main className="relative mx-auto max-w-[1200px] px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pt-8 md:pb-12">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          {isPractice ? "Practice Leaderboard" : "Leaderboard"}
        </h1>
        <p className="mt-1 text-body-gray">
          {isPractice
            ? "Ranked by practice matches played"
            : activeTab === "skillpoints"
              ? "Top 100 players ranked by lifetime SkillPoints"
            : IS_SWEEPSTAKES_LAUNCH
              ? "Weekly alpha standings. Top players split the $100 prize pool."
              : "See how you stack up against the competition"}
        </p>

        {!isPractice && (
          // Real-money leaderboard: only show overall tabs, no per-game filters
          <div className="mt-6 flex flex-nowrap gap-2 overflow-x-auto border-b border-white/5 pb-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-teal text-charcoal"
                    : "bg-card text-body-gray hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
            {isTabRevalidating ? (
              <span className="ml-2 inline-flex items-center text-xs text-body-gray">
                Updating...
              </span>
            ) : null}
          </div>
        )}

        {/* Podium - Top 3 */}
        {showPodium && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {podium[1] && (
            <div
              className="order-2 sm:order-1 flex flex-col items-center rounded-card border-2 border-[#C0C0C0] bg-card p-6 animate-fade-in"
              style={{ animationDelay: "0.1s" }}
            >
              <p className="text-2xl font-bold text-[#C0C0C0]">#2</p>
              <div
                className={`mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${podium[1].avatarGradient} text-2xl font-bold text-white`}
              >
                {podium[1].username.charAt(0)}
              </div>
              <p className="mt-2 font-semibold text-white">{podium[1].username}</p>
              {podium[1].isCurrentUser && (
                <span className={`mt-1 rounded px-2 py-0.5 text-xs ${isPractice ? "bg-purple-500/20 text-purple-400" : "bg-teal/20 text-teal"}`}>You</span>
              )}
              <p className="mt-2 text-lg font-bold text-white">
                {isPractice ? (
                  `${podium[1].totalMatches} matches`
                ) : activeTab === "skillpoints" ? (
                  <span className="inline-flex items-center gap-1">
                    {(podium[1].lifetimeSp ?? 0).toLocaleString()} <SPIcon size={16} />
                  </span>
                ) : (
                  getMainStat(podium[1], activeTab)
                )}
              </p>
            </div>
          )}
          {podium[0] && (
            <div
              className="order-1 sm:order-2 flex flex-col items-center rounded-card border-2 border-[#FFD700] bg-card p-6 shadow-[0_0_30px_rgba(255,215,0,0.2)] animate-fade-in"
              style={{ animationDelay: "0s" }}
            >
              <span className="text-2xl" aria-hidden />
              <p className="text-2xl font-bold text-[#FFD700]">#1</p>
              <div
                className={`mt-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${podium[0].avatarGradient} text-3xl font-bold text-white`}
              >
                {podium[0].username.charAt(0)}
              </div>
              <p className="mt-2 font-semibold text-white">{podium[0].username}</p>
              {podium[0].isCurrentUser && (
                <span className={`mt-1 rounded px-2 py-0.5 text-xs ${isPractice ? "bg-purple-500/20 text-purple-400" : "bg-teal/20 text-teal"}`}>You</span>
              )}
              <p className="mt-2 text-xl font-bold text-[#FFD700]">
                {isPractice ? (
                  `${podium[0].totalMatches} matches`
                ) : activeTab === "skillpoints" ? (
                  <span className="inline-flex items-center gap-1">
                    {(podium[0].lifetimeSp ?? 0).toLocaleString()} <SPIcon size={18} />
                  </span>
                ) : (
                  getMainStat(podium[0], activeTab)
                )}
              </p>
            </div>
          )}
          {podium[2] && (
            <div
              className="order-3 flex flex-col items-center rounded-card border-2 border-[#CD7F32] bg-card p-6 animate-fade-in"
              style={{ animationDelay: "0.2s" }}
            >
              <p className="text-2xl font-bold text-[#CD7F32]">#3</p>
              <div
                className={`mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${podium[2].avatarGradient} text-2xl font-bold text-white`}
              >
                {podium[2].username.charAt(0)}
              </div>
              <p className="mt-2 font-semibold text-white">{podium[2].username}</p>
              {podium[2].isCurrentUser && (
                <span className={`mt-1 rounded px-2 py-0.5 text-xs ${isPractice ? "bg-purple-500/20 text-purple-400" : "bg-teal/20 text-teal"}`}>You</span>
              )}
              <p className="mt-2 text-lg font-bold text-white">
                {isPractice ? (
                  `${podium[2].totalMatches} matches`
                ) : activeTab === "skillpoints" ? (
                  <span className="inline-flex items-center gap-1">
                    {(podium[2].lifetimeSp ?? 0).toLocaleString()} <SPIcon size={16} />
                  </span>
                ) : (
                  getMainStat(podium[2], activeTab)
                )}
              </p>
            </div>
          )}
        </div>
        )}

        {/* Search + Table */}
        <div className="mt-8">
          <div className="mb-4 flex justify-end">
            <input
              type="text"
              placeholder="Search player..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full max-w-xs rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-2 text-sm text-white placeholder:text-body-gray focus:outline-none focus:ring-1 ${
                isPractice ? "focus:border-purple-500 focus:ring-purple-500" : "focus:border-teal focus:ring-teal"
              }`}
            />
          </div>

          {/* Desktop table */}
          <div className="card-border hidden overflow-hidden rounded-card md:block">
            <table className="w-full text-left text-sm">
              <thead>
                {isPractice ? (
                  <tr className="border-b border-white/5 bg-card">
                    <th className="px-4 py-3 font-medium text-body-gray">Rank</th>
                    <th className="px-4 py-3 font-medium text-body-gray">Player</th>
                    <th className="px-4 py-3 font-medium text-body-gray">Practice Matches</th>
                    <th className="px-4 py-3 font-medium text-body-gray">Win %</th>
                  </tr>
                ) : (
                  <tr className="border-b border-white/5 bg-card">
                    <th className="px-4 py-3 font-medium text-body-gray">Rank</th>
                    <th className="px-4 py-3 font-medium text-body-gray">Player</th>
                    {activeTab === "skillpoints" ? (
                      <th className="px-4 py-3 font-medium text-body-gray">Lifetime SP</th>
                    ) : (
                      <>
                        <th className="px-4 py-3 font-medium text-body-gray">Rating</th>
                        <th className="px-4 py-3 font-medium text-body-gray">W / L</th>
                        <th className="px-4 py-3 font-medium text-body-gray">Top Game</th>
                        <th className="px-4 py-3 font-medium text-body-gray">Earnings</th>
                      </>
                    )}
                  </tr>
                )}
              </thead>
              <tbody>
                {visiblePlayers.map((player, i) => {
                  const rank = i + (showPodium ? 4 : 1);
                  const rowBaseClasses = `border-b border-white/5 transition-colors ${
                    rank % 2 === 0 ? "bg-card" : "bg-[#1A1A22]"
                  } ${
                    activeTab === "skillpoints" && player.id === currentUserId
                      ? "bg-[#FFFF00]/8"
                      : player.isCurrentUser
                        ? isPractice
                          ? "bg-purple-500/10"
                          : "bg-teal/10"
                        : ""
                  }`;

                  if (isPractice) {
                    return (
                      <tr
                        key={player.id}
                        className={`${rowBaseClasses} ${isPractice ? "hover:border-l-2 hover:border-l-purple-500" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium text-body-gray">#{rank}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${player.avatarGradient} text-sm font-bold text-white`}
                            >
                              {player.username.charAt(0)}
                            </div>
                            <span className="font-medium text-white">{player.username}</span>
                            {player.isCurrentUser && (
                              <span className="rounded px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400">You</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-white">{player.totalMatches}</td>
                        <td className="px-4 py-3 text-body-gray">
                          {player.totalMatches > 0 ? `${player.winRate.toFixed(1)}%` : "0.0%"}
                        </td>
                      </tr>
                    );
                  }

                  const wins = player.wins ?? Math.round((player.winRate / 100) * player.totalMatches);
                  const losses = player.losses ?? Math.max(0, player.totalMatches - wins);
                  const topGame = player.topGame ?? "All Games";
                  const earnings = player.totalEarnings;
                  const earningsClass =
                    earnings > 0 ? "text-emerald-400" : earnings < 0 ? "text-red-400" : "text-body-gray";

                  return (
                    <tr
                      key={player.id}
                      className={`${rowBaseClasses} ${
                        activeTab === "skillpoints" && player.id === currentUserId
                          ? "border-l-2 border-l-[#FFFF00]"
                          : "hover:border-l-2 hover:border-l-teal"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-body-gray">#{rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {activeTab === "skillpoints" ? (
                            <RankBadge tier={player.rankTier ?? "bronze"} />
                          ) : (
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${player.avatarGradient} text-sm font-bold text-white`}
                            >
                              {player.username.charAt(0)}
                            </div>
                          )}
                          <span className="font-medium text-white">{player.username}</span>
                          {player.isCurrentUser && (
                            <span className="rounded px-2 py-0.5 text-xs bg-teal/20 text-teal">You</span>
                          )}
                        </div>
                      </td>
                      {activeTab === "skillpoints" ? (
                        <td className="px-4 py-3 font-semibold text-white">
                          <span className="inline-flex items-center gap-1">
                            {(player.lifetimeSp ?? 0).toLocaleString()} <SPIcon size={16} />
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-semibold text-white">{player.skillRating}</td>
                          <td className="px-4 py-3 text-body-gray">
                            {wins}W - {losses}L
                          </td>
                          <td className="px-4 py-3 text-body-gray">
                            {getTopGameEmoji(topGame)} {topGame}
                          </td>
                          <td className={`px-4 py-3 font-semibold ${earningsClass}`}>{formatCurrency(earnings)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {visiblePlayers.map((player, i) => {
              const rank = i + (showPodium ? 4 : 1);
              return (
                <div
                  key={player.id}
                  className={`card-border flex items-center justify-between gap-3 rounded-card p-4 ${
                    activeTab === "skillpoints" && player.id === currentUserId
                      ? "border-[#FFFF00]/60 bg-[#FFFF00]/10"
                      : player.isCurrentUser
                        ? (isPractice ? "border-purple-500/30 bg-purple-500/10" : "border-teal/30 bg-teal/10")
                        : ""
                  }`}
                >
                  <p className="w-8 shrink-0 text-body-gray">#{rank}</p>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {activeTab === "skillpoints" ? (
                      <RankBadge tier={player.rankTier ?? "bronze"} />
                    ) : (
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${player.avatarGradient} text-sm font-bold text-white`}
                      >
                        {player.username.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{player.username}</p>
                      <p className="text-xs text-body-gray">
                        {isPractice
                          ? player.totalMatches > 0
                            ? `${player.winRate.toFixed(1)}% win`
                            : "0.0% win"
                          : getSecondaryStat(player, activeTab)}
                      </p>
                    </div>
                    {player.isCurrentUser && (
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${isPractice ? "bg-purple-500/20 text-purple-400" : "bg-teal/20 text-teal"}`}>You</span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-white">
                      {activeTab === "skillpoints"
                        ? (
                            <span className="inline-flex items-center gap-1">
                              {(player.lifetimeSp ?? 0).toLocaleString()} <SPIcon size={14} />
                            </span>
                          )
                        : isPractice
                          ? player.totalMatches
                          : getMainStat(player, activeTab)}
                    </p>
                    {!isPractice && (
                      <span className={player.trend === "up" ? "text-emerald-400" : "text-red-400"}>
                        {player.trend === "up" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className={`rounded-lg px-6 py-2.5 font-medium ${
                  isPractice
                    ? "border border-purple-500/50 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
                    : "border border-teal/50 bg-teal/10 text-teal hover:bg-teal/20"
                }`}
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
      {/* Your Rank sticky bar (sits above bottom tab bar on mobile) */}
      {currentUserRank != null && currentUserPlayer && (
        <div className="fixed bottom-[60px] left-0 right-0 z-30 border-t border-white/5 bg-charcoal/95 backdrop-blur-sm md:bottom-0">
          <div className={`mx-auto flex max-w-[1200px] items-center justify-between gap-4 border-l-4 px-4 py-3 sm:px-6 ${isPractice ? "border-purple-500" : "border-teal"}`}>
            <span className="text-sm text-body-gray">Your Rank:</span>
            <span className={`font-bold ${isPractice ? "text-purple-400" : "text-teal"}`}>#{currentUserRank}</span>
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${currentUserPlayer.avatarGradient} text-sm font-bold text-white`}
              >
                {currentUserPlayer.username.charAt(0)}
              </div>
              <span className="font-medium text-white">{currentUserPlayer.username}</span>
            </div>
            <span className="font-semibold text-white">
              {isPractice ? (
                `${currentUserPlayer.totalMatches} matches`
              ) : activeTab === "skillpoints" ? (
                <span className="inline-flex items-center gap-1">
                  {(currentUserPlayer.lifetimeSp ?? 0).toLocaleString()} <SPIcon size={14} />
                </span>
              ) : (
                getMainStat(currentUserPlayer, activeTab)
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
