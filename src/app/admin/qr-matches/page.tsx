"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell, RelativeTime } from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";

type QRRow = {
  id: string;
  idShort: string;
  host: string;
  game: string;
  stakeSK: number;
  status: string;
  opponent: string;
  outcome: string;
  createdAt: string;
};

type PayoutRow = {
  id: string;
  amountSK: number;
  createdAt: string;
  expiresAt: string;
  daysUntilExpiry: number;
  claimed: boolean;
  claimedAt: string | null;
};

type Stats = {
  totalCreated: number;
  acceptRate: number;
  anonymousWinToSignupRate: number;
};

export default function AdminQRMatchesPage() {
  const [matches, setMatches] = useState<QRRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{
        matches: QRRow[];
        payouts: PayoutRow[];
        stats: Stats;
      }>("/api/admin/qr-matches");
      setMatches(data.matches);
      setPayouts(data.payouts);
      setStats(data.stats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0E0E12] p-6 text-white lg:pl-64">
      <AdminPageHeader title="QR Matches" subtitle="In-person QR match activity (last 7 days)" />

      {stats ? (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Total QR matches" value={String(stats.totalCreated)} />
          <StatCard label="Accept rate" value={`${stats.acceptRate}%`} />
          <StatCard label="Anon win → signup" value={`${stats.anonymousWinToSignupRate}%`} />
        </div>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold lowercase text-[#9CA3AF]">recent qr matches</h2>
      <AdminTableShell loading={loading} empty={matches.length === 0} emptyMessage="No QR matches in the last 7 days">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs lowercase text-[#9CA3AF]">
              <th className="px-4 py-3">id</th>
              <th className="px-4 py-3">host</th>
              <th className="px-4 py-3">game</th>
              <th className="px-4 py-3">stake</th>
              <th className="px-4 py-3">status</th>
              <th className="px-4 py-3">opponent</th>
              <th className="px-4 py-3">outcome</th>
              <th className="px-4 py-3">created</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-mono text-xs">{m.idShort}</td>
                <td className="px-4 py-3">{m.host}</td>
                <td className="px-4 py-3">{m.game}</td>
                <td className="px-4 py-3">{m.stakeSK} SK</td>
                <td className="px-4 py-3">
                  <AdminStatusBadge status={m.status} />
                </td>
                <td className="px-4 py-3">{m.opponent}</td>
                <td className="px-4 py-3">{m.outcome}</td>
                <td className="px-4 py-3">
                  <RelativeTime iso={m.createdAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableShell>

      <h2 className="mb-3 mt-10 text-sm font-semibold lowercase text-[#9CA3AF]">pending anonymous payouts</h2>
      <AdminTableShell loading={loading} empty={payouts.length === 0} emptyMessage="No pending payouts">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs lowercase text-[#9CA3AF]">
              <th className="px-4 py-3">amount</th>
              <th className="px-4 py-3">created</th>
              <th className="px-4 py-3">days left</th>
              <th className="px-4 py-3">claimed</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="px-4 py-3">{p.amountSK} SK</td>
                <td className="px-4 py-3">
                  <RelativeTime iso={p.createdAt} />
                </td>
                <td className="px-4 py-3">{p.claimed ? "—" : p.daysUntilExpiry}</td>
                <td className="px-4 py-3">{p.claimed ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#16161C] px-4 py-4">
      <p className="text-xs lowercase text-[#9CA3AF]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#FFFF00]">{value}</p>
    </div>
  );
}
