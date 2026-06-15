"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminConfirmModal, {
  AdminPageHeader,
  AdminTableShell,
  HealthDot,
  MoneyPair,
} from "@/components/admin/AdminShared";
import RevenueChart from "@/components/admin/RevenueChart";
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
  poolHealth: {
    profilesBalanceSK: number;
    profilesBalanceUSD: number;
    expectedPoolSK: number;
    expectedPoolUSD: number;
    deltaSK: number;
    deltaUSD: number;
    deltaPct: number;
    level: "green" | "yellow" | "red";
  };
  dailyRevenue30: Array<{
    date: string;
    label: string;
    revenueUSD: number;
    amount: number;
  }>;
  fixedCostsUSD: number;
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

function downloadTaxCsv(rows: FinancialsData["monthlyPnL"]) {
  const header = [
    "month",
    "deposits usd",
    "withdrawals usd",
    "rake usd",
    "creator payouts usd",
    "xsolla fees usd",
    "net revenue usd",
  ];
  const data = rows.map((r) => [
    r.month,
    r.depositsUSD.toFixed(2),
    r.withdrawalsUSD.toFixed(2),
    r.rakeUSD.toFixed(2),
    r.creatorPayoutsUSD.toFixed(2),
    r.xsollaFeesUSD.toFixed(2),
    r.netRevenueUSD.toFixed(2),
  ]);
  const csv = [header, ...data]
    .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `skillflow-financials-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminFinancialsPage() {
  const [data, setData] = useState<FinancialsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [payAllOpen, setPayAllOpen] = useState(false);
  const [fixedCosts, setFixedCosts] = useState("");
  const [savingCosts, setSavingCosts] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<FinancialsData>("/api/admin/financials");
      setData(res);
      setFixedCosts(String(res.fixedCostsUSD ?? 0));
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

  async function payAll() {
    await adminFetch("/api/admin/financials", {
      method: "POST",
      body: JSON.stringify({ action: "pay_all" }),
    });
    setPayAllOpen(false);
    void load();
  }

  async function saveFixedCosts() {
    setSavingCosts(true);
    try {
      await adminFetch("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ key: "fixed_costs_usd", value: fixedCosts }),
      });
      void load();
    } finally {
      setSavingCosts(false);
    }
  }

  const breakEvenDays = useMemo(() => {
    if (!data) return null;
    const avgDaily =
      data.dailyRevenue30.reduce((s, d) => s + d.revenueUSD, 0) /
      Math.max(1, data.dailyRevenue30.length);
    const costs = Number(fixedCosts) || 0;
    if (avgDaily <= 0) return null;
    return Math.ceil(costs / avgDaily);
  }, [data, fixedCosts]);

  const chartData = useMemo(
    () =>
      (data?.dailyRevenue30 ?? []).map((d) => ({
        date: d.date,
        label: d.label,
        amount: d.revenueUSD,
      })),
    [data]
  );

  if (loading && !data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  const s = data?.summary;
  const ph = data?.poolHealth;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <AdminPageHeader title="financials" />
        <button
          type="button"
          onClick={() => downloadTaxCsv(data?.monthlyPnL ?? [])}
          className="rounded-lg px-4 py-2 text-sm font-medium lowercase text-black"
          style={{ background: "#FFFF00" }}
        >
          tax export csv
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <div className="mb-4 flex items-center gap-2">
            <HealthDot level={ph?.level ?? "green"} />
            <h2 className="text-sm lowercase text-[#C8C8D4]">pool health</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">profiles balance</dt>
              <dd>
                {ph ? <MoneyPair sk={ph.profilesBalanceSK} usd={ph.profilesBalanceUSD} /> : null}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">expected pool (deposits − withdrawals)</dt>
              <dd>
                {ph ? <MoneyPair sk={ph.expectedPoolSK} usd={ph.expectedPoolUSD} /> : null}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">delta</dt>
              <dd
                className={
                  ph && Math.abs(ph.deltaPct) <= 2
                    ? "text-emerald-400"
                    : ph && Math.abs(ph.deltaPct) <= 10
                      ? "text-[#FFFF00]"
                      : "text-red-400"
                }
              >
                {ph ? (
                  <>
                    {ph.deltaSK >= 0 ? "+" : ""}
                    {ph.deltaSK} sk ({ph.deltaPct >= 0 ? "+" : ""}
                    {ph.deltaPct}%)
                  </>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <h2 className="mb-4 text-sm lowercase text-[#C8C8D4]">break-even analysis</h2>
          <label className="text-xs lowercase text-[#7A7A8E]">monthly fixed costs (usd)</label>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              value={fixedCosts}
              onChange={(e) => setFixedCosts(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              disabled={savingCosts}
              onClick={() => void saveFixedCosts()}
              className="rounded-lg px-4 py-2 text-sm lowercase text-black disabled:opacity-40"
              style={{ background: "#FFFF00" }}
            >
              {savingCosts ? "saving…" : "save"}
            </button>
          </div>
          {breakEvenDays != null ? (
            <p className="mt-4 text-sm text-[#C8C8D4]">
              break-even at current avg daily revenue:{" "}
              <span className="text-white">{breakEvenDays} days</span>
            </p>
          ) : (
            <p className="mt-4 text-sm text-[#7A7A8E]">insufficient revenue data for break-even.</p>
          )}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
        <h2 className="mb-4 text-sm lowercase text-[#C8C8D4]">30-day revenue</h2>
        <RevenueChart
          data={chartData}
          totalLabel="total 30 days"
          averageLabel="avg daily"
          color="#FFFF00"
        />
      </div>

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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm lowercase text-[#C8C8D4]">pending creator payouts</h2>
          {(data?.pendingPayouts ?? []).length > 0 ? (
            <button
              type="button"
              onClick={() => setPayAllOpen(true)}
              className="rounded px-3 py-1.5 text-xs lowercase text-black"
              style={{ background: "#FFFF00" }}
            >
              pay all
            </button>
          ) : null}
        </div>
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

      <AdminConfirmModal
        open={payAllOpen}
        title="pay all creators"
        message="Mark all pending creator payouts as paid?"
        confirmLabel="pay all"
        confirmTone="warning"
        onCancel={() => setPayAllOpen(false)}
        onConfirm={() => void payAll()}
      />
    </div>
  );
}
