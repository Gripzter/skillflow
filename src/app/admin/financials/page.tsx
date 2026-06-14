"use client";

import { useCallback, useEffect, useState } from "react";
import AdminConfirmModal, {
  AdminPageHeader,
  AdminTableShell,
  MoneyPair,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";

type FinancialsData = {
  summary: {
    poolBalanceSK: number;
    poolBalanceUSD: number;
    totalDepositedUSD: number;
    totalWithdrawnUSD: number;
    totalRakeSK: number;
    totalRakeUSD: number;
    pendingCreatorPayoutsUSD: number;
    paidCreatorPayoutsUSD: number;
    xsollaFeesUSD: number;
    netPlatformRevenueUSD: number;
  };
  monthlyPnL: Array<{
    month: string;
    depositsUSD: number;
    withdrawalsUSD: number;
    rakeUSD: number;
    creatorPayoutsUSD: number;
    xsollaFeesUSD: number;
    netRevenueUSD: number;
  }>;
  pendingPayouts: Array<{
    creatorId: string;
    creatorName: string;
    pendingUSD: number;
    pendingSK: number;
  }>;
};

export default function AdminFinancialsPage() {
  const [data, setData] = useState<FinancialsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<FinancialsData>("/api/admin/financials");
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markPaid(creatorId: string) {
    await adminFetch("/api/admin/financials", {
      method: "POST",
      body: JSON.stringify({ action: "mark_paid", creatorId }),
    });
    setMarkPaidId(null);
    void load();
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div>
      <AdminPageHeader title="financials" />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">total pool balance</p>
          <div className="mt-2">
            {s ? <MoneyPair sk={s.poolBalanceSK} usd={s.poolBalanceUSD} /> : null}
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">total deposited</p>
          <p className="mt-2 text-xl text-white">${s?.totalDepositedUSD.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">total withdrawn</p>
          <p className="mt-2 text-xl text-white">${s?.totalWithdrawnUSD.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">total rake collected</p>
          <div className="mt-2">
            {s ? <MoneyPair sk={s.totalRakeSK} usd={s.totalRakeUSD} /> : null}
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">creator payouts pending</p>
          <p className="mt-2 text-xl text-[#FFFF00]">${s?.pendingCreatorPayoutsUSD.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">creator payouts paid</p>
          <p className="mt-2 text-xl text-white">${s?.paidCreatorPayoutsUSD.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">xsolla fees (est.)</p>
          <p className="mt-2 text-xl text-[#C8C8D4]">${s?.xsollaFeesUSD.toFixed(2)}</p>
          <p className="mt-1 text-xs text-[#7A7A8E]">5% of deposits</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <p className="text-xs lowercase text-[#7A7A8E]">net platform revenue</p>
          <p className="mt-2 text-xl text-emerald-400">${s?.netPlatformRevenueUSD.toFixed(2)}</p>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
        <h2 className="mb-4 text-sm lowercase text-[#C8C8D4]">pending creator payouts</h2>
        {(data?.pendingPayouts ?? []).length === 0 ? (
          <p className="text-sm text-[#7A7A8E]">no pending payouts.</p>
        ) : (
          <ul className="space-y-3">
            {(data?.pendingPayouts ?? []).map((p) => (
              <li key={p.creatorId} className="flex items-center justify-between text-sm">
                <span>
                  {p.creatorName} — <MoneyPair sk={p.pendingSK} usd={p.pendingUSD} />
                </span>
                <button
                  type="button"
                  onClick={() => setMarkPaidId(p.creatorId)}
                  className="rounded px-3 py-1 text-xs lowercase text-black"
                  style={{ background: "#FFFF00" }}
                >
                  mark as paid
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
        <h2 className="mb-4 text-sm lowercase text-[#C8C8D4]">monthly p&amp;l</h2>
        <AdminTableShell>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">month</th>
                <th className="px-4 py-3">deposits</th>
                <th className="px-4 py-3">withdrawals</th>
                <th className="px-4 py-3">rake</th>
                <th className="px-4 py-3">creator payouts</th>
                <th className="px-4 py-3">xsolla fees</th>
                <th className="px-4 py-3">net revenue</th>
              </tr>
            </thead>
            <tbody>
              {(data?.monthlyPnL ?? []).map((row, i) => (
                <tr key={row.month} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                  <td className="px-4 py-3">{row.month}</td>
                  <td className="px-4 py-3">${row.depositsUSD.toFixed(2)}</td>
                  <td className="px-4 py-3">${row.withdrawalsUSD.toFixed(2)}</td>
                  <td className="px-4 py-3">${row.rakeUSD.toFixed(2)}</td>
                  <td className="px-4 py-3">${row.creatorPayoutsUSD.toFixed(2)}</td>
                  <td className="px-4 py-3">${row.xsollaFeesUSD.toFixed(2)}</td>
                  <td className="px-4 py-3 text-emerald-400">${row.netRevenueUSD.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      </div>

      <AdminConfirmModal
        open={!!markPaidId}
        title="mark payouts as paid"
        message="Mark all pending creator_earnings for this creator as paid?"
        confirmLabel="mark as paid"
        onCancel={() => setMarkPaidId(null)}
        onConfirm={() => markPaidId && void markPaid(markPaidId)}
      />
    </div>
  );
}
