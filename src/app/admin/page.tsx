"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
  MoneyPair,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";
import { truncateId } from "@/lib/admin-api";

type OverviewData = {
  stats: {
    revenueTodaySK: number;
    revenueTodayUSD: number;
    revenueMonthSK: number;
    revenueMonthUSD: number;
    activePlayers: number;
    totalMatches: number;
  };
  liveFeed: Array<{
    id: string;
    gameName: string;
    player1: string;
    player2: string;
    entrySK: number;
    potSK: number;
    status: string;
    winner: string;
    timestamp: string;
  }>;
  health: {
    revenueChart: Array<{ label: string; skillflowNetSK: number; skillflowNetUSD: number }>;
    topGamesByMatches: Array<{ game: string; count: number }>;
    topGamesByRevenue: Array<{ game: string; skillflowNetSK: number; skillflowNetUSD: number }>;
  };
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch<OverviewData>("/api/admin/overview");
      setData(res);
    } catch (err) {
      console.error("[admin overview]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10000);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div>
      <AdminPageHeader title="overview" subtitle="auto-refreshes every 10 seconds" />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">revenue today</p>
          <div className="mt-2">
            {stats ? (
              <MoneyPair sk={stats.revenueTodaySK} usd={stats.revenueTodayUSD} />
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">revenue this month</p>
          <div className="mt-2">
            {stats ? (
              <MoneyPair sk={stats.revenueMonthSK} usd={stats.revenueMonthUSD} />
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">active players now</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {stats?.activePlayers ?? 0}
          </p>
          <p className="mt-1 text-xs text-[#7A7A8E]">match activity last 10 min</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">total matches</p>
          <p className="mt-2 text-2xl font-semibold text-[#FFFF00]">
            {(stats?.totalMatches ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <h2 className="mb-4 text-sm font-medium lowercase text-[#C8C8D4]">live match feed</h2>
          <AdminTableShell>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                  <th className="px-4 py-3">match</th>
                  <th className="px-4 py-3">game</th>
                  <th className="px-4 py-3">players</th>
                  <th className="px-4 py-3">pot</th>
                  <th className="px-4 py-3">status</th>
                  <th className="px-4 py-3">winner</th>
                </tr>
              </thead>
              <tbody>
                {(data?.liveFeed ?? []).map((m, i) => (
                  <tr key={m.id} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                    <td className="px-4 py-3 font-mono text-xs">{truncateId(m.id)}</td>
                    <td className="px-4 py-3">{m.gameName}</td>
                    <td className="px-4 py-3 text-[#C8C8D4]">
                      {m.player1} vs {m.player2}
                    </td>
                    <td className="px-4 py-3 text-[#FFFF00]">{m.potSK} sk</td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3 text-[#C8C8D4]">{m.winner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
            <h2 className="mb-4 text-sm font-medium lowercase text-[#C8C8D4]">
              revenue last 7 days
            </h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.health.revenueChart ?? []}>
                  <CartesianGrid stroke="#2A2A38" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "#7A7A8E", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#7A7A8E", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#1A1A1F",
                      border: "1px solid #2A2A38",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="skillflowNetSK" fill="#FFFF00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
              <h3 className="mb-3 text-xs font-medium lowercase text-[#7A7A8E]">
                top games by matches today
              </h3>
              <ul className="space-y-2 text-sm">
                {(data?.health.topGamesByMatches ?? []).map((g) => (
                  <li key={g.game} className="flex justify-between text-[#C8C8D4]">
                    <span>{g.game}</span>
                    <span className="text-white">{g.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
              <h3 className="mb-3 text-xs font-medium lowercase text-[#7A7A8E]">
                top games by revenue today
              </h3>
              <ul className="space-y-2 text-sm">
                {(data?.health.topGamesByRevenue ?? []).map((g) => (
                  <li key={g.game} className="flex justify-between text-[#C8C8D4]">
                    <span>{g.game}</span>
                    <MoneyPair sk={g.skillflowNetSK} usd={g.skillflowNetUSD} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
