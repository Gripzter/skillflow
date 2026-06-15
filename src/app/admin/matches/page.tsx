"use client";

import { useCallback, useEffect, useState } from "react";
import AdminConfirmModal, {
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
  MoneyPair,
  RelativeTime,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";

type MatchRow = {
  id: string;
  idShort: string;
  game: string;
  player1: string;
  player2: string;
  entrySK: number;
  potSK: number;
  rakeSK: number;
  creatorCutSK: number;
  skillflowNetSK: number;
  skillflowNetUSD: number;
  winner: string;
  status: string;
  durationSec: number | null;
  timestamp: string;
  suspicious: boolean;
  suspiciousReasons: string[];
};

function downloadCsv(rows: MatchRow[]) {
  const header = [
    "match id",
    "game",
    "player 1",
    "player 2",
    "entry sk",
    "pot sk",
    "rake sk",
    "creator cut sk",
    "skillflow net sk",
    "skillflow net usd",
    "winner",
    "status",
    "duration sec",
    "timestamp",
    "suspicious",
  ];
  const data = rows.map((r) => [
    r.id,
    r.game,
    r.player1,
    r.player2,
    String(r.entrySK),
    String(r.potSK),
    String(r.rakeSK),
    String(r.creatorCutSK),
    String(r.skillflowNetSK),
    String(r.skillflowNetUSD),
    r.winner,
    r.status,
    r.durationSec == null ? "" : String(r.durationSec),
    r.timestamp,
    r.suspicious ? r.suspiciousReasons.join(";") : "",
  ]);
  const csv = [header, ...data]
    .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `admin-matches-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [game, setGame] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minPot, setMinPot] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkVoidOpen, setBulkVoidOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status !== "all") params.set("status", status);
      if (game !== "all") params.set("game", game);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minPot) params.set("minPot", minPot);
      const res = await adminFetch<{ matches: MatchRow[]; pagination: { total: number } }>(
        `/api/admin/matches?${params}`
      );
      setMatches(res.matches);
      setTotal(res.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [page, status, game, dateFrom, dateTo, minPot]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === matches.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(matches.map((m) => m.id)));
    }
  }

  async function bulkVoid() {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      await adminFetch("/api/admin/matches/bulk", {
        method: "POST",
        body: JSON.stringify({ action: "void", matchIds: Array.from(selected) }),
      });
      setSelected(new Set());
      setBulkVoidOpen(false);
      void load();
    } finally {
      setBulkLoading(false);
    }
  }

  function formatDuration(sec: number | null) {
    if (sec == null) return "—";
    if (sec < 60) return `${sec.toFixed(0)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <AdminPageHeader title="matches" />
        <div className="flex gap-2">
          {selected.size > 0 ? (
            <button
              type="button"
              onClick={() => setBulkVoidOpen(true)}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm lowercase text-red-400"
            >
              void selected ({selected.size})
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => downloadCsv(matches)}
            className="rounded-lg px-4 py-2 text-sm font-medium lowercase text-black"
            style={{ background: "#FFFF00" }}
          >
            export csv
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 rounded-xl border border-white/5 bg-[#1A1A1F] p-4">
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
        >
          <option value="all">all statuses</option>
          <option value="in_progress">in progress</option>
          <option value="timed_out">timed out</option>
          <option value="completed">completed</option>
          <option value="voided">voided</option>
          <option value="forfeited">forfeited</option>
          <option value="cancelled">cancelled</option>
        </select>
        <input
          value={game === "all" ? "" : game}
          onChange={(e) => {
            setPage(1);
            setGame(e.target.value || "all");
          }}
          placeholder="game filter"
          className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setPage(1);
            setDateFrom(e.target.value);
          }}
          className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setPage(1);
            setDateTo(e.target.value);
          }}
          className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
        />
        <input
          type="number"
          value={minPot}
          onChange={(e) => {
            setPage(1);
            setMinPot(e.target.value);
          }}
          placeholder="min pot sk"
          className="rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
        />
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
        </div>
      ) : (
        <>
          <AdminTableShell>
            <table className="w-full min-w-[1300px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={matches.length > 0 && selected.size === matches.length}
                      onChange={toggleAll}
                      className="accent-[#FFFF00]"
                    />
                  </th>
                  <th className="px-3 py-3">⚠</th>
                  <th className="px-3 py-3">match id</th>
                  <th className="px-3 py-3">game</th>
                  <th className="px-3 py-3">player 1</th>
                  <th className="px-3 py-3">player 2</th>
                  <th className="px-3 py-3">entry</th>
                  <th className="px-3 py-3">pot</th>
                  <th className="px-3 py-3">skillflow net</th>
                  <th className="px-3 py-3">winner</th>
                  <th className="px-3 py-3">status</th>
                  <th className="px-3 py-3">duration</th>
                  <th className="px-3 py-3">time</th>
                  <th className="px-3 py-3">replay</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr
                    key={m.id}
                    className={`${i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"} ${
                      m.suspicious ? "outline outline-1 outline-orange-500/40" : ""
                    }`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                        className="accent-[#FFFF00]"
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      {m.suspicious ? (
                        <span className="text-orange-400" title={m.suspiciousReasons.join(", ")}>
                          ⚠
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{m.idShort}</td>
                    <td className="px-3 py-3">{m.game}</td>
                    <td className="px-3 py-3">{m.player1}</td>
                    <td className="px-3 py-3">{m.player2}</td>
                    <td className="px-3 py-3 text-[#FFFF00]">{m.entrySK}</td>
                    <td className="px-3 py-3 text-[#FFFF00]">{m.potSK}</td>
                    <td className="px-3 py-3">
                      <MoneyPair sk={m.skillflowNetSK} usd={m.skillflowNetUSD} />
                    </td>
                    <td className="px-3 py-3">{m.winner}</td>
                    <td className="px-3 py-3">
                      <AdminStatusBadge status={m.status} />
                    </td>
                    <td className="px-3 py-3 text-[#C8C8D4]">{formatDuration(m.durationSec)}</td>
                    <td className="px-3 py-3 text-[#C8C8D4]">
                      <RelativeTime iso={m.timestamp} />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = `/admin/matches/${m.id}`;
                        }}
                        className="rounded border border-white/10 px-2 py-1 text-xs lowercase text-[#FFFF00] hover:bg-white/5"
                      >
                        view replay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>

          <div className="mt-4 flex items-center justify-between text-sm text-[#7A7A8E]">
            <span>
              page {page} of {totalPages} ({total} matches)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-white/10 px-3 py-1 disabled:opacity-40"
              >
                previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-white/10 px-3 py-1 disabled:opacity-40"
              >
                next
              </button>
            </div>
          </div>
        </>
      )}

      <AdminConfirmModal
        open={bulkVoidOpen}
        title="bulk void matches"
        message={`Void ${selected.size} selected match(es)? Stakes will be refunded.`}
        confirmLabel="void all"
        confirmTone="danger"
        loading={bulkLoading}
        onCancel={() => setBulkVoidOpen(false)}
        onConfirm={() => void bulkVoid()}
      />
    </div>
  );
}
