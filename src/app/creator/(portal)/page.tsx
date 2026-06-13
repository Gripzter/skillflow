"use client";

import {
  CreatorStatCard,
  CreatorStatusBadge,
  CreatorWarningBanner,
  CreatorLoadingSpinner,
} from "@/components/creator/CreatorSidebar";
import EarningsChart from "@/components/creator/EarningsChart";
import {
  formatSK,
  formatUSD,
  truncateMatchId,
  useCreatorProfile,
  useCreatorStats,
  useRecentCreatorMatches,
  SKILLIES_PER_USD,
} from "@/hooks/useCreatorData";

export default function CreatorOverviewPage() {
  const { profile, loading: profileLoading } = useCreatorProfile();
  const { daily, matchesToday, loading: statsLoading } = useCreatorStats();
  const { rows: recentMatches, loading: matchesLoading } = useRecentCreatorMatches(10);

  if (profileLoading || !profile) {
    return <CreatorLoadingSpinner />;
  }

  const totalEarnedUSD = Number(profile.total_earned_sk) / SKILLIES_PER_USD;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold lowercase text-white">overview</h1>
          <p className="mt-1 text-sm lowercase text-[#7A7A8E]">{profile.game_name}</p>
        </div>
        <CreatorStatusBadge status={profile.status} />
      </div>

      <CreatorWarningBanner status={profile.status} />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CreatorStatCard label="total matches" value={String(profile.total_matches)} />
        <CreatorStatCard
          label="total earned"
          value={formatUSD(totalEarnedUSD)}
          subValue={formatSK(Number(profile.total_earned_sk))}
        />
        <CreatorStatCard label="matches today" value={String(matchesToday)} />
        <CreatorStatCard
          label="current status"
          value={profile.status}
          valueClassName={
            profile.status === "active"
              ? "text-emerald-400"
              : profile.status === "pending"
                ? "text-[#FFFF00]"
                : "text-red-400"
          }
        />
      </div>

      <div className="mb-8 rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
        <h2 className="mb-4 text-sm font-medium lowercase text-[#C8C8D4]">
          last 30 days — matches and earnings
        </h2>
        {statsLoading ? <CreatorLoadingSpinner /> : <EarningsChart data={daily} />}
      </div>

      <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
        <h2 className="mb-4 text-sm font-medium lowercase text-[#C8C8D4]">recent matches</h2>
        {matchesLoading ? (
          <CreatorLoadingSpinner />
        ) : recentMatches.length === 0 ? (
          <p className="text-sm lowercase text-[#7A7A8E]">no matches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                  <th className="pb-3 pr-4 font-medium">match id</th>
                  <th className="pb-3 pr-4 font-medium">date</th>
                  <th className="pb-3 pr-4 font-medium">pot (sk)</th>
                  <th className="pb-3 pr-4 font-medium">earned (sk)</th>
                  <th className="pb-3 pr-4 font-medium">earned ($)</th>
                  <th className="pb-3 font-medium">status</th>
                </tr>
              </thead>
              <tbody>
                {recentMatches.map((row, i) => (
                  <tr
                    key={row.matchId}
                    className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}
                  >
                    <td className="py-3 pr-4 font-mono text-xs text-[#C8C8D4]">
                      {truncateMatchId(row.matchId)}
                    </td>
                    <td className="py-3 pr-4 text-[#C8C8D4]">
                      {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 text-[#FFFF00]">{formatSK(row.potSK)}</td>
                    <td className="py-3 pr-4 text-[#FFFF00]">{formatSK(row.creatorCutSK)}</td>
                    <td className="py-3 pr-4 text-[#C8C8D4]">{formatUSD(row.creatorCutUSD)}</td>
                    <td className="py-3">
                      <span
                        className={
                          row.status === "completed"
                            ? "text-emerald-400"
                            : "text-[#7A7A8E]"
                        }
                      >
                        {row.status}
                      </span>
                    </td>
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
