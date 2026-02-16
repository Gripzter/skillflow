"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import { getCurrentUser, getLeaderboard, logout as apiLogout } from "@/lib/api";
import {
  generateFakeLeaderboard,
  sortAndRankPlayers,
  getMainStat,
  getSecondaryStat,
  type LeaderboardPlayer,
  type LeaderboardTab,
} from "@/lib/leaderboard-data";

const TABS: { id: LeaderboardTab; label: string }[] = [
  { id: "earnings", label: "Top Earners" },
  { id: "winRate", label: "Highest Win Rate" },
  { id: "matches", label: "Most Matches" },
  { id: "rating", label: "Skill Rating" },
];

const GAME_FILTERS = ["All Games", "8 Ball Pool", "Chess"];
const PAGE_SIZE = 20;

export default function LeaderboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string>("Player");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  const [rawPlayers, setRawPlayers] = useState<LeaderboardPlayer[]>([]);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("earnings");
  const [gameFilter, setGameFilter] = useState("All Games");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

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
        const apiPlayers = await getLeaderboard("total_earnings");
        if (apiPlayers == null) {
          setRawPlayers(generateFakeLeaderboard(user.username, 15 + Math.floor(Math.random() * 16)));
        } else {
          const withCurrent = apiPlayers.map((p) => ({
            ...p,
            isCurrentUser: p.username === user.username,
          }));
          setRawPlayers(withCurrent);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const sortedPlayers = useMemo(
    () => sortAndRankPlayers(rawPlayers, activeTab),
    [rawPlayers, activeTab]
  );

  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return sortedPlayers;
    const q = search.trim().toLowerCase();
    return sortedPlayers.filter((p) => p.username.toLowerCase().includes(q));
  }, [sortedPlayers, search]);

  const podium = filteredPlayers.slice(0, 3);
  const tablePlayers = filteredPlayers.slice(3);
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <svg className="h-10 w-10 animate-spin text-teal" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal pb-24">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="leaderboard"
      />

      <main className="relative mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          Leaderboard 🏆
        </h1>
        <p className="mt-1 text-body-gray">See how you stack up against the competition</p>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-white/5 pb-4">
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
        </div>

        {/* Game filter */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {GAME_FILTERS.map((game) => (
            <button
              key={game}
              type="button"
              onClick={() => setGameFilter(game)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                gameFilter === game
                  ? "border-teal/50 bg-teal/10 text-teal"
                  : "border-white/10 text-body-gray hover:text-white"
              }`}
            >
              {game}
            </button>
          ))}
        </div>

        {/* Podium - Top 3 */}
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
                <span className="mt-1 rounded bg-teal/20 px-2 py-0.5 text-xs text-teal">You</span>
              )}
              <p className="mt-2 text-lg font-bold text-white">{getMainStat(podium[1], activeTab)}</p>
            </div>
          )}
          {podium[0] && (
            <div
              className="order-1 sm:order-2 flex flex-col items-center rounded-card border-2 border-[#FFD700] bg-card p-6 shadow-[0_0_30px_rgba(255,215,0,0.2)] animate-fade-in"
              style={{ animationDelay: "0s" }}
            >
              <span className="text-2xl">👑</span>
              <p className="text-2xl font-bold text-[#FFD700]">#1</p>
              <div
                className={`mt-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${podium[0].avatarGradient} text-3xl font-bold text-white`}
              >
                {podium[0].username.charAt(0)}
              </div>
              <p className="mt-2 font-semibold text-white">{podium[0].username}</p>
              {podium[0].isCurrentUser && (
                <span className="mt-1 rounded bg-teal/20 px-2 py-0.5 text-xs text-teal">You</span>
              )}
              <p className="mt-2 text-xl font-bold text-[#FFD700]">{getMainStat(podium[0], activeTab)}</p>
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
                <span className="mt-1 rounded bg-teal/20 px-2 py-0.5 text-xs text-teal">You</span>
              )}
              <p className="mt-2 text-lg font-bold text-white">{getMainStat(podium[2], activeTab)}</p>
            </div>
          )}
        </div>

        {/* Search + Table */}
        <div className="mt-8">
          <div className="mb-4 flex justify-end">
            <input
              type="text"
              placeholder="Search player..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-2 text-sm text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>

          {/* Desktop table */}
          <div className="card-border hidden overflow-hidden rounded-card md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-card">
                  <th className="px-4 py-3 font-medium text-body-gray">Rank</th>
                  <th className="px-4 py-3 font-medium text-body-gray">Player</th>
                  <th className="px-4 py-3 font-medium text-body-gray">
                    {activeTab === "earnings" && "Total Earnings"}
                    {activeTab === "winRate" && "Win Rate"}
                    {activeTab === "matches" && "Matches"}
                    {activeTab === "rating" && "Rating"}
                  </th>
                  <th className="px-4 py-3 font-medium text-body-gray">Secondary</th>
                  <th className="px-4 py-3 font-medium text-body-gray">Trend</th>
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map((player, i) => {
                  const rank = i + 4;
                  return (
                    <tr
                      key={player.id}
                      className={`border-b border-white/5 transition-colors hover:border-l-2 hover:border-l-teal ${
                        rank % 2 === 0 ? "bg-[#151821]" : "bg-[#1A1D27]"
                      } ${player.isCurrentUser ? "bg-teal/10" : ""}`}
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
                            <span className="rounded bg-teal/20 px-2 py-0.5 text-xs text-teal">You</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{getMainStat(player, activeTab)}</td>
                      <td className="px-4 py-3 text-body-gray">{getSecondaryStat(player, activeTab)}</td>
                      <td className="px-4 py-3">
                        <span className={player.trend === "up" ? "text-emerald-400" : "text-red-400"}>
                          {player.trend === "up" ? "↑" : "↓"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {visiblePlayers.map((player, i) => {
              const rank = i + 4;
              return (
                <div
                  key={player.id}
                  className={`card-border flex items-center justify-between gap-3 rounded-card p-4 ${
                    player.isCurrentUser ? "border-teal/30 bg-teal/10" : ""
                  }`}
                >
                  <p className="w-8 shrink-0 text-body-gray">#{rank}</p>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${player.avatarGradient} text-sm font-bold text-white`}
                    >
                      {player.username.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{player.username}</p>
                      <p className="text-xs text-body-gray">{getSecondaryStat(player, activeTab)}</p>
                    </div>
                    {player.isCurrentUser && (
                      <span className="shrink-0 rounded bg-teal/20 px-2 py-0.5 text-xs text-teal">You</span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-white">{getMainStat(player, activeTab)}</p>
                    <span className={player.trend === "up" ? "text-emerald-400" : "text-red-400"}>
                      {player.trend === "up" ? "↑" : "↓"}
                    </span>
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
                className="rounded-lg border border-teal/50 bg-teal/10 px-6 py-2.5 font-medium text-teal hover:bg-teal/20"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Your Rank sticky bar */}
      {currentUserRank != null && currentUserPlayer && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-charcoal/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 border-l-4 border-teal px-4 py-3 sm:px-6">
            <span className="text-sm text-body-gray">Your Rank:</span>
            <span className="font-bold text-teal">#{currentUserRank}</span>
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${currentUserPlayer.avatarGradient} text-sm font-bold text-white`}
              >
                {currentUserPlayer.username.charAt(0)}
              </div>
              <span className="font-medium text-white">{currentUserPlayer.username}</span>
            </div>
            <span className="font-semibold text-white">{getMainStat(currentUserPlayer, activeTab)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
