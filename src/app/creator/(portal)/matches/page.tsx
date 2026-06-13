"use client";

import { useMemo, useState } from "react";
import {
  CreatorWarningBanner,
  CreatorLoadingSpinner,
} from "@/components/creator/CreatorSidebar";
import {
  formatSK,
  formatUSD,
  truncateMatchId,
  useCreatorMatches,
  useCreatorProfile,
  type MatchFilters,
} from "@/hooks/useCreatorData";

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CreatorMatchesPage() {
  const { profile, loading: profileLoading, isSuspended } = useCreatorProfile();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<MatchFilters["status"]>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filters = useMemo<MatchFilters>(
    () => ({ status, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    [status, dateFrom, dateTo]
  );

  const { rows, total, pageSize, loading, error } = useCreatorMatches(page, filters);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (profileLoading || !profile) {
    return <CreatorLoadingSpinner />;
  }

  function handleExport() {
    if (isSuspended) return;
    const header = [
      "match id",
      "date",
      "entry fee (sk)",
      "pot (sk)",
      "your cut (sk)",
      "your cut ($)",
      "status",
    ];
    const data = rows.map((r) => [
      r.matchId,
      new Date(r.date).toISOString(),
      String(r.entrySK),
      String(r.potSK),
      String(r.creatorCutSK),
      String(r.creatorCutUSD),
      r.status,
    ]);
    downloadCsv(`skillflow-matches-${new Date().toISOString().slice(0, 10)}.csv`, [
      header,
      ...data,
    ]);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold lowercase text-white">match logs</h1>
        <button
          type="button"
          disabled={isSuspended || rows.length === 0}
          onClick={handleExport}
          className="rounded-lg px-4 py-2 text-sm font-medium lowercase text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "#FFFF00" }}
        >
          export to csv
        </button>
      </div>

      <CreatorWarningBanner status={profile.status} />

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-white/5 bg-[#1A1A1F] p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-xs lowercase text-[#7A7A8E]">
          from
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setPage(1);
              setDateFrom(e.target.value);
            }}
            className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs lowercase text-[#7A7A8E]">
          to
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setPage(1);
              setDateTo(e.target.value);
            }}
            className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs lowercase text-[#7A7A8E]">
          status
          <select
            value={status ?? "all"}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as MatchFilters["status"]);
            }}
            className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
          >
            <option value="all">all</option>
            <option value="completed">completed</option>
            <option value="voided">voided</option>
          </select>
        </label>
      </div>

      {loading ? (
        <CreatorLoadingSpinner />
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#1A1A1F]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                  <th className="px-4 py-3 font-medium">match id</th>
                  <th className="px-4 py-3 font-medium">date</th>
                  <th className="px-4 py-3 font-medium">entry fee (sk)</th>
                  <th className="px-4 py-3 font-medium">pot (sk)</th>
                  <th className="px-4 py-3 font-medium">your cut (sk)</th>
                  <th className="px-4 py-3 font-medium">your cut ($)</th>
                  <th className="px-4 py-3 font-medium">status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#7A7A8E]">
                      no matches found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr
                      key={row.matchId}
                      className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[#C8C8D4]">
                        {truncateMatchId(row.matchId)}
                      </td>
                      <td className="px-4 py-3 text-[#C8C8D4]">
                        {new Date(row.date).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-[#FFFF00]">{formatSK(row.entrySK)}</td>
                      <td className="px-4 py-3 text-[#FFFF00]">{formatSK(row.potSK)}</td>
                      <td className="px-4 py-3 text-[#FFFF00]">{formatSK(row.creatorCutSK)}</td>
                      <td className="px-4 py-3 text-[#C8C8D4]">{formatUSD(row.creatorCutUSD)}</td>
                      <td className="px-4 py-3 lowercase text-[#C8C8D4]">{row.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-[#7A7A8E]">
            <span>
              page {page} of {totalPages} ({total} matches)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-white/10 px-3 py-1.5 lowercase disabled:opacity-40"
              >
                previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-white/10 px-3 py-1.5 lowercase disabled:opacity-40"
              >
                next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
