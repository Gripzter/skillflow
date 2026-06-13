"use client";

import {
  CreatorStatCard,
  CreatorWarningBanner,
  CreatorLoadingSpinner,
} from "@/components/creator/CreatorSidebar";
import {
  formatSK,
  formatUSD,
  useCreatorEarnings,
  useCreatorProfile,
} from "@/hooks/useCreatorData";

export default function CreatorEarningsPage() {
  const { profile, loading: profileLoading } = useCreatorProfile();
  const { summary, loading, error } = useCreatorEarnings();

  if (profileLoading || !profile) {
    return <CreatorLoadingSpinner />;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold lowercase text-white">earnings</h1>
      <CreatorWarningBanner status={profile.status} />

      {loading ? (
        <CreatorLoadingSpinner />
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CreatorStatCard
              label="lifetime earnings"
              value={formatUSD(summary?.totalEarnedUSD ?? 0)}
              subValue={formatSK(summary?.totalEarnedSK ?? 0)}
            />
            <CreatorStatCard
              label="pending payout"
              value={formatUSD(summary?.pendingPayoutUSD ?? 0)}
              subValue={formatSK(summary?.pendingPayoutSK ?? 0)}
              valueClassName="text-white"
            />
          </div>

          <p className="mb-6 rounded-lg border border-white/5 bg-[#1A1A1F] px-4 py-3 text-sm text-[#7A7A8E]">
            payouts processed monthly via xsolla. minimum payout threshold: $50.
          </p>

          <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
            <h2 className="mb-4 text-sm font-medium lowercase text-[#C8C8D4]">
              monthly breakdown
            </h2>
            {!summary?.monthly.length ? (
              <p className="text-sm lowercase text-[#7A7A8E]">no earnings recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                      <th className="pb-3 pr-4 font-medium">month</th>
                      <th className="pb-3 pr-4 font-medium">matches played</th>
                      <th className="pb-3 pr-4 font-medium">gross (sk)</th>
                      <th className="pb-3 font-medium">gross ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.monthly.map((row, i) => (
                      <tr
                        key={row.month}
                        className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}
                      >
                        <td className="py-3 pr-4 lowercase text-[#C8C8D4]">{row.month}</td>
                        <td className="py-3 pr-4 text-[#C8C8D4]">{row.matches}</td>
                        <td className="py-3 pr-4 text-[#FFFF00]">{formatSK(row.grossSK)}</td>
                        <td className="py-3 text-[#C8C8D4]">{formatUSD(row.grossUSD)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
