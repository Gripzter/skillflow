"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader, AdminTableShell, MoneyPair } from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";

export default function AdminPlayerDetailPage({ params }: { params: { userId: string } }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadPlayer>> | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPlayer() {
    return adminFetch<{
      player: Record<string, unknown>;
      recentMatches: Array<Record<string, unknown>>;
    }>(`/api/admin/players/${params.userId}`);
  }

  useEffect(() => {
    void loadPlayer()
      .then(setData)
      .finally(() => setLoading(false));
  }, [params.userId]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  const player = data?.player;

  return (
    <div>
      <AdminPageHeader
        title={(player?.username as string) ?? "player"}
        subtitle={player?.email as string}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">balance</p>
          <div className="mt-2">
            <MoneyPair
              sk={Number(player?.balanceSK ?? 0)}
              usd={Number(player?.balanceUSD ?? 0)}
            />
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">total matches</p>
          <p className="mt-2 text-2xl text-white">{player?.totalMatches as number}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">status</p>
          <p className="mt-2 text-lg lowercase text-white">
            {player?.banned ? "banned" : "active"}
          </p>
        </div>
      </div>

      <AdminTableShell>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
              <th className="px-4 py-3">match id</th>
              <th className="px-4 py-3">game</th>
              <th className="px-4 py-3">stake</th>
              <th className="px-4 py-3">status</th>
              <th className="px-4 py-3">date</th>
            </tr>
          </thead>
          <tbody>
            {(data?.recentMatches ?? []).map((m, i) => (
              <tr key={m.id as string} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                <td className="px-4 py-3 font-mono text-xs">{String(m.id).slice(0, 8)}…</td>
                <td className="px-4 py-3">{m.game_type as string}</td>
                <td className="px-4 py-3 text-[#FFFF00]">{m.stake_sp as number} sk</td>
                <td className="px-4 py-3">{m.status as string}</td>
                <td className="px-4 py-3 text-[#C8C8D4]">
                  {new Date(m.created_at as string).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableShell>

      <button
        type="button"
        onClick={() => {
          window.location.href = "/admin/players";
        }}
        className="mt-6 rounded border border-white/10 px-4 py-2 text-sm lowercase text-[#C8C8D4]"
      >
        back to players
      </button>
    </div>
  );
}
