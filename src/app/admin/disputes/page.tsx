"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
  RelativeTime,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";
import { truncateId } from "@/lib/admin-api";

type DisputeRow = {
  id: string;
  matchId: string;
  submittedBy: string;
  submittedById: string;
  game: string;
  reason: string;
  status: string;
  resolution: string | null;
  resolutionNote: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  ageHours: number;
};

type DisputesData = {
  disputes: DisputeRow[];
  stats: {
    openCount: number;
    avgResolutionHours: number;
    thisMonth: number;
    resolutionBreakdown: {
      refunded: number;
      voided: number;
      dismissed: number;
    };
  };
};

export default function AdminDisputesPage() {
  const [data, setData] = useState<DisputesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await adminFetch<DisputesData>(`/api/admin/disputes${params}`);
      setData(res);
    } catch (err) {
      console.error("[admin disputes]", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  const stats = data?.stats;
  const disputes = data?.disputes ?? [];

  return (
    <div>
      <AdminPageHeader title="disputes" subtitle="click a row to open the match" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="open disputes"
          value={String(stats?.openCount ?? 0)}
          highlight={stats && stats.openCount > 0}
        />
        <StatCard
          label="avg resolution time"
          value={`${stats?.avgResolutionHours ?? 0}h`}
        />
        <StatCard label="this month" value={String(stats?.thisMonth ?? 0)} />
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">resolution breakdown</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-[#C8C8D4]">
            <span>refunded: {stats?.resolutionBreakdown.refunded ?? 0}</span>
            <span>voided: {stats?.resolutionBreakdown.voided ?? 0}</span>
            <span>dismissed: {stats?.resolutionBreakdown.dismissed ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {["all", "open", "under_review", "resolved"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs lowercase ${
              statusFilter === s
                ? "bg-[#FFFF00] text-black"
                : "border border-white/10 text-[#C8C8D4] hover:bg-white/5"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <AdminTableShell>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
              <th className="px-4 py-3">dispute</th>
              <th className="px-4 py-3">match</th>
              <th className="px-4 py-3">game</th>
              <th className="px-4 py-3">submitted by</th>
              <th className="px-4 py-3">reason</th>
              <th className="px-4 py-3">status</th>
              <th className="px-4 py-3">age</th>
              <th className="px-4 py-3">submitted</th>
            </tr>
          </thead>
          <tbody>
            {disputes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[#7A7A8E]">
                  no disputes found
                </td>
              </tr>
            ) : (
              disputes.map((d, i) => (
                <tr
                  key={d.id}
                  className={`cursor-pointer ${i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"} hover:bg-white/5`}
                  onClick={() => {
                    window.location.href = `/admin/matches/${d.matchId}`;
                  }}
                >
                  <td className="px-4 py-3 font-mono text-xs">{truncateId(d.id)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#FFFF00]">
                    {truncateId(d.matchId)}
                  </td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{d.game}</td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{d.submittedBy}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-[#C8C8D4]" title={d.reason}>
                    {d.reason}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{d.ageHours}h</td>
                  <td className="px-4 py-3 text-[#7A7A8E]">
                    <RelativeTime iso={d.submittedAt} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminTableShell>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
      <p className="text-xs lowercase text-[#7A7A8E]">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${highlight ? "text-red-400" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
