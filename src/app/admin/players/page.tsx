"use client";

import { useCallback, useEffect, useState } from "react";
import AdminConfirmModal, {
  AdminPageHeader,
  AdminTableShell,
  MoneyPair,
  RelativeTime,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";

type PlayerRow = {
  id: string;
  username: string;
  email: string;
  joinedAt: string;
  totalMatches: number;
  totalDepositedUSD: number;
  totalWithdrawnUSD: number;
  balanceSK: number;
  balanceUSD: number;
  country: string;
  countryFlag: string;
  lastActive: string;
  winRate: number;
  totalWageredSK: number;
  suspicious: boolean;
  banned: boolean;
};

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [banned, setBanned] = useState("all");
  const [minBalance, setMinBalance] = useState("");
  const [minMatches, setMinMatches] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingBan, setPendingBan] = useState<{ id: string; username: string; ban: boolean } | null>(
    null
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search });
      if (country !== "all") params.set("country", country);
      if (banned !== "all") params.set("banned", banned);
      if (minBalance) params.set("minBalance", minBalance);
      if (minMatches) params.set("minMatches", minMatches);
      const res = await adminFetch<{ players: PlayerRow[] }>(`/api/admin/players?${params}`);
      setPlayers(res.players);
    } finally {
      setLoading(false);
    }
  }, [search, country, banned, minBalance, minMatches]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const countries = Array.from(new Set(players.map((p) => p.country).filter((c) => c !== "—")));

  async function applyBan() {
    if (!pendingBan) return;
    const prev = players;
    setPlayers((rows) =>
      rows.map((r) => (r.id === pendingBan.id ? { ...r, banned: pendingBan.ban } : r))
    );
    try {
      await adminFetch("/api/admin/players", {
        method: "PATCH",
        body: JSON.stringify({ userId: pendingBan.id, banned: pendingBan.ban }),
      });
    } catch {
      setPlayers(prev);
    } finally {
      setPendingBan(null);
    }
  }

  return (
    <div>
      <AdminPageHeader title="players" />

      <div className="mb-6 flex flex-wrap gap-3 rounded-xl border border-white/5 bg-[#1A1A1F] p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search username or email"
          className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
        >
          <option value="all">all countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={banned}
          onChange={(e) => setBanned(e.target.value)}
          className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
        >
          <option value="all">all ban statuses</option>
          <option value="false">not banned</option>
          <option value="true">banned</option>
        </select>
        <input
          type="number"
          value={minBalance}
          onChange={(e) => setMinBalance(e.target.value)}
          placeholder="min balance sk"
          className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
        />
        <input
          type="number"
          value={minMatches}
          onChange={(e) => setMinMatches(e.target.value)}
          placeholder="min matches"
          className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
        />
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
        </div>
      ) : (
        <AdminTableShell>
          <table className="w-full min-w-[1300px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3">username</th>
                <th className="px-4 py-3">email</th>
                <th className="px-4 py-3">country</th>
                <th className="px-4 py-3">last active</th>
                <th className="px-4 py-3">matches</th>
                <th className="px-4 py-3">win rate</th>
                <th className="px-4 py-3">wagered</th>
                <th className="px-4 py-3">balance</th>
                <th className="px-4 py-3">status</th>
                <th className="px-4 py-3">actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    window.location.href = `/admin/players/${p.id}`;
                  }}
                  className={`cursor-pointer ${i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"} hover:bg-white/5`}
                >
                  <td className="px-4 py-3">
                    {p.suspicious ? (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full bg-orange-400"
                        title="suspicious"
                      />
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{p.username}</td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{p.email}</td>
                  <td className="px-4 py-3">
                    <span title={p.country}>
                      {p.countryFlag} {p.country}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#C8C8D4]">
                    <RelativeTime iso={p.lastActive} />
                  </td>
                  <td className="px-4 py-3">{p.totalMatches}</td>
                  <td className="px-4 py-3">{p.winRate}%</td>
                  <td className="px-4 py-3 text-[#FFFF00]">{p.totalWageredSK} sk</td>
                  <td className="px-4 py-3">
                    <MoneyPair sk={p.balanceSK} usd={p.balanceUSD} />
                  </td>
                  <td className="px-4 py-3">{p.banned ? "banned" : "active"}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingBan({
                          id: p.id,
                          username: p.username,
                          ban: !p.banned,
                        })
                      }
                      className={`rounded px-2 py-1 text-xs lowercase ${
                        p.banned
                          ? "bg-[#FFFF00]/20 text-[#FFFF00]"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {p.banned ? "unban" : "ban"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      )}

      <AdminConfirmModal
        open={!!pendingBan}
        title={pendingBan?.ban ? "ban player" : "unban player"}
        message={`Are you sure you want to ${pendingBan?.ban ? "ban" : "unban"} ${pendingBan?.username}?`}
        confirmLabel={pendingBan?.ban ? "ban" : "unban"}
        confirmTone={pendingBan?.ban ? "danger" : "warning"}
        onCancel={() => setPendingBan(null)}
        onConfirm={() => void applyBan()}
      />
    </div>
  );
}
