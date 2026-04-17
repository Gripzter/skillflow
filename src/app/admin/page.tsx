"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import StatCard from "@/components/admin/StatCard";
import RevenueChart from "@/components/admin/RevenueChart";
import type { RevenueDataPoint } from "@/components/admin/RevenueChart";
import VelocityLoader from "@/components/VelocityLoader";

interface RecentMatch {
  id: string;
  game_type: string;
  player1Name: string;
  player2Name: string;
  stake_amount: number;
  platform_fee: number;
  status: string;
  result: string | null;
  created_at: string;
}

function gameLabel(type: string): string {
  const map: Record<string, string> = {
    chess: "Chess",
    checkers: "Checkers",
    "connect-four": "Connect 4",
    pool: "8-Ball Pool",
    memory: "Memory",
    reaction: "Reaction Duel",
    spelling: "Spelling Bee",
    "last-touch": "Last Touch",
  };
  return map[type] ?? type;
}

function timeAgo(iso: string): string {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeUsers: 0,
    matchesToday: 0,
    signupsThisWeek: 0,
  });
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase not configured.");
        setLoading(false);
        return;
      }

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const weekAgo = new Date(now.getTime() - 7 * 86400_000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000);

      const [
        { data: allMatchFees },
        { data: recentPlayers },
        { count: matchesToday },
        { count: signupsThisWeek },
        { data: last30Matches },
        { data: recentRaw },
      ] = await Promise.all([
        supabase.from("matches").select("platform_fee").eq("status", "completed"),
        supabase
          .from("matches")
          .select("player1_id, player2_id")
          .gte("created_at", weekAgo.toISOString()),
        supabase
          .from("matches")
          .select("*", { count: "exact", head: true })
          .gte("created_at", todayStart.toISOString()),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekAgo.toISOString()),
        supabase
          .from("matches")
          .select("platform_fee, created_at")
          .eq("status", "completed")
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at"),
        supabase
          .from("matches")
          .select("id, game_type, player1_id, player2_id, stake_amount, platform_fee, status, result, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      // Total revenue
      const totalRevenue = allMatchFees?.reduce((s, m) => s + (m.platform_fee || 0), 0) ?? 0;

      // Active users (distinct players last 7 days)
      const ids = new Set<string>();
      recentPlayers?.forEach((m) => {
        if (m.player1_id) ids.add(m.player1_id);
        if (m.player2_id) ids.add(m.player2_id);
      });

      // Revenue chart: group completed match fees by day
      const byDate: Record<string, number> = {};
      last30Matches?.forEach((m) => {
        const d = m.created_at.slice(0, 10);
        byDate[d] = (byDate[d] || 0) + (m.platform_fee || 0);
      });
      const chartData: RevenueDataPoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        chartData.push({
          date: dateStr,
          amount: Math.round((byDate[dateStr] || 0) * 100) / 100,
          label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        });
      }

      // Recent matches — join profiles for names
      let enrichedMatches: RecentMatch[] = [];
      if (recentRaw && recentRaw.length > 0) {
        const pids = Array.from(
          new Set(recentRaw.flatMap((m) => [m.player1_id, m.player2_id].filter(Boolean)))
        );
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", pids);
        const profileMap = new Map(profiles?.map((p) => [p.id, p.username]) ?? []);
        enrichedMatches = recentRaw.map((m) => ({
          ...m,
          player1Name: profileMap.get(m.player1_id) ?? "Player 1",
          player2Name: profileMap.get(m.player2_id) ?? "Bot",
        }));
      }

      setStats({
        totalRevenue,
        activeUsers: ids.size,
        matchesToday: matchesToday ?? 0,
        signupsThisWeek: signupsThisWeek ?? 0,
      });
      setRevenueData(chartData);
      setRecentMatches(enrichedMatches);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <VelocityLoader />;
  }

  const totalChart = revenueData.reduce((s, d) => s + d.amount, 0);
  const avgChart = revenueData.length ? totalChart / revenueData.length : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={`$${stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="All-time platform fees"
          trend="up"
          icon="💰"
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers.toLocaleString()}
          subtitle="Played in last 7 days"
          trend="neutral"
          icon="👥"
        />
        <StatCard
          title="Matches Today"
          value={stats.matchesToday.toLocaleString()}
          subtitle="Since midnight"
          trend="neutral"
          icon="🎮"
        />
        <StatCard
          title="Signups This Week"
          value={stats.signupsThisWeek.toLocaleString()}
          subtitle="New profiles (7 days)"
          trend="up"
          icon="✨"
        />
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border border-white/5 bg-admin-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Platform Revenue — Last 30 Days</h2>
          <Link
            href="/admin/revenue"
            className="text-sm hover:underline"
            style={{ color: "#FF5E00" }}
          >
            Full report →
          </Link>
        </div>
        <div className="mt-4">
          <RevenueChart
            data={revenueData}
            totalValue={totalChart}
            averageValue={avgChart}
            totalLabel="30-day total"
            averageLabel="Daily avg"
            color="#FF5E00"
          />
        </div>
      </div>

      {/* Recent matches */}
      <div className="rounded-xl border border-white/5 bg-admin-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent Matches</h2>
          <Link
            href="/admin/matches"
            className="text-sm hover:underline"
            style={{ color: "#FF5E00" }}
          >
            View all →
          </Link>
        </div>

        {recentMatches.length === 0 ? (
          <p className="mt-4 text-sm text-[#9CA3AF]">No matches yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[#9CA3AF]">
                  <th className="pb-2 pr-4 font-medium">Game</th>
                  <th className="pb-2 pr-4 font-medium">Players</th>
                  <th className="pb-2 pr-4 font-medium">Stake</th>
                  <th className="pb-2 pr-4 font-medium">Fee</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {recentMatches.map((m) => (
                  <tr key={m.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-4 text-white">{gameLabel(m.game_type)}</td>
                    <td className="py-2 pr-4 text-[#9CA3AF]">
                      {m.player1Name} vs {m.player2Name}
                    </td>
                    <td className="py-2 pr-4 text-[#9CA3AF]">
                      ${(m.stake_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 text-admin-success">
                      ${(m.platform_fee || 0).toFixed(2)}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.status === "completed"
                            ? "bg-green-500/10 text-green-400"
                            : m.status === "in_progress"
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "bg-white/5 text-[#9CA3AF]"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            m.status === "completed"
                              ? "bg-green-400"
                              : m.status === "in_progress"
                                ? "bg-yellow-400"
                                : "bg-gray-400"
                          }`}
                        />
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2 text-[#9CA3AF]">{timeAgo(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
