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
  HealthDot,
  MoneyPair,
} from "@/components/admin/AdminShared";
import { adminFetch, getAdminAccessToken } from "@/lib/admin-client";
import { truncateId } from "@/lib/admin-api";

type OverviewData = {
  realTime: {
    matchesInProgress: number;
    playersOnline: number;
    revenueLast60MinSK: number;
    revenueLast60MinUSD: number;
    openDisputes: number;
    suspendedCreators: number;
  };
  stats: {
    revenueTodaySK: number;
    revenueTodayUSD: number;
    revenueMonthSK: number;
    revenueMonthUSD: number;
    activePlayers: number;
    totalMatches: number;
  };
  forecast: {
    projectedMonthlySK: number;
    projectedMonthlyUSD: number;
    projectedAnnualSK: number;
    projectedAnnualUSD: number;
    variancePct: number;
    varianceLabel: string;
  };
  platformHealth: {
    completionRate: number;
    completionLevel: "green" | "yellow" | "red";
    avgDurationMin: number;
    durationLevel: "green" | "yellow" | "red";
    voidRate: number;
    voidLevel: "green" | "yellow" | "red";
    cheatFlagRate: number;
    cheatLevel: "green" | "yellow" | "red";
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

async function downloadDailyExport() {
  const token = await getAdminAccessToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch("/api/admin/overview/export", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `skillflow-daily-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  useEffect(() => {
    adminFetch<{ settings: Record<string, string> }>("/api/admin/settings")
      .then((res) => setMaintenanceMode(res.settings.maintenance_mode === "true"))
      .catch(() => {});
  }, []);

  async function toggleMaintenance() {
    setTogglingMaintenance(true);
    const next = !maintenanceMode;
    try {
      await adminFetch("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ key: "maintenance_mode", value: next ? "true" : "false" }),
      });
      setMaintenanceMode(next);
    } catch (err) {
      console.error("[maintenance toggle]", err);
    } finally {
      setTogglingMaintenance(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadDailyExport();
    } catch (err) {
      console.error("[export]", err);
    } finally {
      setExporting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  const stats = data?.stats;
  const rt = data?.realTime;
  const forecast = data?.forecast;
  const ph = data?.platformHealth;

  return (
    <div>
      <AdminPageHeader title="overview" subtitle="auto-refreshes every 10 seconds" />

      {rt ? (
        <div className="mb-6 flex flex-wrap gap-3 rounded-xl border border-white/5 bg-[#1A1A1F] px-4 py-3">
          <MetricPill label="matches in progress" value={String(rt.matchesInProgress)} />
          <MetricPill label="players online" value={String(rt.playersOnline)} />
          <div className="flex items-center gap-2 rounded-lg bg-[#0E0E12] px-3 py-1.5">
            <span className="text-xs lowercase text-[#7A7A8E]">revenue last 60m</span>
            <MoneyPair sk={rt.revenueLast60MinSK} usd={rt.revenueLast60MinUSD} />
          </div>
          <MetricPill
            label="open disputes"
            value={String(rt.openDisputes)}
            alert={rt.openDisputes > 0 ? "red" : undefined}
          />
          <MetricPill
            label="suspended creators"
            value={String(rt.suspendedCreators)}
            alert={rt.suspendedCreators > 0 ? "orange" : undefined}
          />
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            window.location.href = "/admin/broadcast";
          }}
          className="rounded-lg bg-[#FFFF00] px-4 py-2 text-sm font-medium lowercase text-black hover:opacity-90"
        >
          broadcast message
        </button>
        <button
          type="button"
          disabled={togglingMaintenance}
          onClick={() => void toggleMaintenance()}
          className={`rounded-lg border px-4 py-2 text-sm lowercase disabled:opacity-50 ${
            maintenanceMode
              ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
              : "border-white/10 text-[#C8C8D4] hover:bg-white/5"
          }`}
        >
          {togglingMaintenance
            ? "updating…"
            : maintenanceMode
              ? "maintenance mode on — turn off"
              : "maintenance mode off — turn on"}
        </button>
        <button
          type="button"
          disabled={exporting}
          onClick={() => void handleExport()}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm lowercase text-[#C8C8D4] hover:bg-white/5 disabled:opacity-50"
        >
          {exporting ? "exporting…" : "export daily csv"}
        </button>
      </div>

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
          <p className="mt-2 text-2xl font-semibold text-white">{stats?.activePlayers ?? 0}</p>
          <p className="mt-1 text-xs text-[#7A7A8E]">match activity last 10 min</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">total matches</p>
          <p className="mt-2 text-2xl font-semibold text-[#FFFF00]">
            {(stats?.totalMatches ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {forecast ? (
          <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
            <h2 className="mb-4 text-sm font-medium lowercase text-[#C8C8D4]">
              revenue forecast
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs lowercase text-[#7A7A8E]">projected monthly</p>
                <div className="mt-1">
                  <MoneyPair sk={forecast.projectedMonthlySK} usd={forecast.projectedMonthlyUSD} />
                </div>
              </div>
              <div>
                <p className="text-xs lowercase text-[#7A7A8E]">projected annual</p>
                <div className="mt-1">
                  <MoneyPair sk={forecast.projectedAnnualSK} usd={forecast.projectedAnnualUSD} />
                </div>
              </div>
            </div>
            <p
              className={`mt-3 text-sm lowercase ${
                forecast.variancePct >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {forecast.varianceLabel}
            </p>
          </div>
        ) : null}

        {ph ? (
          <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
            <h2 className="mb-4 text-sm font-medium lowercase text-[#C8C8D4]">
              platform health
            </h2>
            <ul className="space-y-3 text-sm">
              <HealthRow
                label="completion rate"
                value={`${ph.completionRate.toFixed(1)}%`}
                level={ph.completionLevel}
              />
              <HealthRow
                label="avg match duration"
                value={`${ph.avgDurationMin.toFixed(1)} min`}
                level={ph.durationLevel}
              />
              <HealthRow
                label="void rate"
                value={`${ph.voidRate.toFixed(1)}%`}
                level={ph.voidLevel}
              />
              <HealthRow
                label="cheat flag rate"
                value={`${ph.cheatFlagRate.toFixed(1)}%`}
                level={ph.cheatLevel}
              />
            </ul>
          </div>
        ) : null}
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
                  <tr
                    key={m.id}
                    className={`cursor-pointer ${i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"} hover:bg-white/5`}
                    onClick={() => {
                      window.location.href = `/admin/matches/${m.id}`;
                    }}
                  >
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

function MetricPill({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: "red" | "orange";
}) {
  const valueClass =
    alert === "red"
      ? "text-red-400"
      : alert === "orange"
        ? "text-orange-400"
        : "text-white";
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[#0E0E12] px-3 py-1.5">
      <span className="text-xs lowercase text-[#7A7A8E]">{label}</span>
      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

function HealthRow({
  label,
  value,
  level,
}: {
  label: string;
  value: string;
  level: "green" | "yellow" | "red";
}) {
  return (
    <li className="flex items-center justify-between text-[#C8C8D4]">
      <span className="lowercase">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-white">{value}</span>
        <HealthDot level={level} />
      </span>
    </li>
  );
}
