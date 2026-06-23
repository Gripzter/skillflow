"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminConfirmModal, {
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
  MoneyPair,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";

export default function AdminCreatorDetailPage({
  params,
}: {
  params: { gameId: string };
}) {
  const gameId = decodeURIComponent(params.gameId);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDetail>> | null>(null);
  const [page, setPage] = useState(1);
  const [revenueShare, setRevenueShare] = useState(20);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [suspendInput, setSuspendInput] = useState("");
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchDetail(pageNum: number) {
    return adminFetch<{
      game: Record<string, unknown>;
      earningsChart: Array<{ label: string; earnedSK: number; earnedUSD: number }>;
      matches: Array<Record<string, unknown>>;
      pagination: { page: number; pageSize: number; total: number };
    }>(`/api/admin/creators/${encodeURIComponent(gameId)}?page=${pageNum}`);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDetail(page);
      setData(res);
      setRevenueShare(Number(res.game.revenue_share_pct ?? 20));
    } finally {
      setLoading(false);
    }
  }, [gameId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRevenueShare() {
    await adminFetch(`/api/admin/creators/${encodeURIComponent(gameId)}`, {
      method: "PATCH",
      body: JSON.stringify({ revenueSharePct: revenueShare }),
    });
    void load();
  }

  async function suspendGame() {
    await adminFetch(`/api/admin/creators/${encodeURIComponent(gameId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "suspended" }),
    });
    setConfirmSuspend(false);
    void load();
  }

  async function regenerateKey() {
    const res = await adminFetch<{ apiKey: string }>(
      `/api/admin/creators/${encodeURIComponent(gameId)}`,
      { method: "POST", body: JSON.stringify({ action: "regenerate_key" }) }
    );
    setNewApiKey(res.apiKey);
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  const game = data?.game;
  const totalPages = Math.max(
    1,
    Math.ceil((data?.pagination.total ?? 0) / (data?.pagination.pageSize ?? 20))
  );

  return (
    <div>
      <AdminPageHeader
        title={(game?.game_name as string) ?? gameId}
        subtitle={`game_id: ${gameId}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <h2 className="mb-4 text-sm lowercase text-[#7A7A8E]">game health</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">completion rate</dt>
              <dd>{Number((data as { gameHealth?: { completionRate?: number } })?.gameHealth?.completionRate ?? 0).toFixed(1)}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">avg duration</dt>
              <dd>{Number((data as { gameHealth?: { avgDurationMin?: number } })?.gameHealth?.avgDurationMin ?? 0).toFixed(1)} min</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">void rate</dt>
              <dd className={(data as { gameHealth?: { voidRate?: number } })?.gameHealth?.voidRate && (data as { gameHealth?: { voidRate?: number } }).gameHealth!.voidRate! > 15 ? "text-orange-400" : ""}>
                {Number((data as { gameHealth?: { voidRate?: number } })?.gameHealth?.voidRate ?? 0).toFixed(1)}%
              </dd>
            </div>
          </dl>
          {(data as { gameHealth?: { investigate?: boolean } })?.gameHealth?.investigate ? (
            <p className="mt-3 text-xs text-orange-400"> investigate game mechanics — void rate &gt; 15%</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <h2 className="mb-4 text-sm lowercase text-[#7A7A8E]">key rotation history</h2>
          <ul className="max-h-32 space-y-2 overflow-y-auto text-xs text-[#C8C8D4]">
            {((data as { keyRotations?: Array<{ created_at: string; key_last4: string }> })?.keyRotations ?? []).map((r) => (
              <li key={r.created_at}>
                {new Date(r.created_at).toLocaleString()} — ••••{r.key_last4}
              </li>
            ))}
            {!(data as { keyRotations?: unknown[] })?.keyRotations?.length ? (
              <li className="text-[#7A7A8E]">no rotations yet</li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <h2 className="mb-4 text-sm lowercase text-[#7A7A8E]">creator info</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">name</dt>
              <dd>{game?.creatorName as string}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">email</dt>
              <dd>{game?.creatorEmail as string}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">joined</dt>
              <dd>{new Date(game?.created_at as string).toLocaleDateString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">status</dt>
              <dd>
                <AdminStatusBadge status={game?.status as string} />
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <label className="text-xs lowercase text-[#7A7A8E]">
              revenue share % ({revenueShare}%)
            </label>
            <input
              type="range"
              min={20}
              max={30}
              value={revenueShare}
              onChange={(e) => setRevenueShare(Number(e.target.value))}
              className="mt-2 w-full accent-[#FFFF00]"
            />
            <button
              type="button"
              onClick={() => void saveRevenueShare()}
              className="mt-3 rounded px-3 py-1.5 text-xs font-medium lowercase text-black"
              style={{ background: "#FFFF00" }}
            >
              save revenue share
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <h2 className="mb-4 text-sm lowercase text-[#7A7A8E]">game info</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">total matches</dt>
              <dd>{game?.total_matches as number}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">total earned</dt>
              <dd>
                <MoneyPair
                  sk={Number(game?.total_earned_sk ?? 0)}
                  usd={Number(game?.totalEarnedUSD ?? 0)}
                />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7A7A8E]">api key</dt>
              <dd className="font-mono text-xs">{game?.apiKeyMasked as string}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => void regenerateKey()}
            className="mt-4 rounded border border-white/10 px-3 py-1.5 text-xs lowercase text-[#C8C8D4]"
          >
            regenerate api key
          </button>
          {newApiKey ? (
            <div className="mt-3 rounded border border-[#FFFF00]/30 bg-[#FFFF00]/10 p-3 text-xs">
              <p className="text-[#FFFF00]">new key (shown once):</p>
              <code className="mt-1 block break-all text-white">{newApiKey}</code>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
        <h2 className="mb-4 text-sm lowercase text-[#C8C8D4]">last 30 days earnings</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.earningsChart ?? []}>
              <CartesianGrid stroke="#2A2A38" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#7A7A8E", fontSize: 11 }} />
              <YAxis tick={{ fill: "#7A7A8E", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#1A1A1F",
                  border: "1px solid #2A2A38",
                  borderRadius: 8,
                }}
              />
              <Line type="monotone" dataKey="earnedSK" stroke="#FFFF00" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
        <h2 className="mb-4 text-sm lowercase text-[#C8C8D4]">match log</h2>
        <AdminTableShell>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">match id</th>
                <th className="px-4 py-3">pot</th>
                <th className="px-4 py-3">status</th>
                <th className="px-4 py-3">timestamp</th>
              </tr>
            </thead>
            <tbody>
              {(data?.matches ?? []).map((m, i) => (
                <tr key={m.matchId as string} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                  <td className="px-4 py-3 font-mono text-xs">{m.matchIdShort as string}</td>
                  <td className="px-4 py-3 text-[#FFFF00]">{m.potSK as number} sk</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={m.status as string} />
                  </td>
                  <td className="px-4 py-3 text-[#C8C8D4]">
                    {new Date(m.timestamp as string).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
        <div className="mt-4 flex justify-between text-sm text-[#7A7A8E]">
          <span>
            page {page} of {totalPages}
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
      </div>

      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
        <h2 className="text-sm font-medium lowercase text-red-400">danger zone</h2>
        <p className="mt-2 text-sm text-[#C8C8D4]">
          suspend this game to block all sdk match activity.
        </p>
        <button
          type="button"
          onClick={() => setConfirmSuspend(true)}
          className="mt-4 rounded bg-red-500 px-4 py-2 text-sm lowercase text-white"
        >
          suspend game
        </button>
      </div>

      <AdminConfirmModal
        open={confirmSuspend}
        title="suspend game"
        message={`Type ${gameId} to confirm suspension.`}
        confirmLabel="suspend"
        confirmTone="danger"
        onCancel={() => {
          setConfirmSuspend(false);
          setSuspendInput("");
        }}
        onConfirm={() => {
          if (suspendInput === gameId) void suspendGame();
        }}
      />
      {confirmSuspend ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 px-4 pb-20">
          <input
            value={suspendInput}
            onChange={(e) => setSuspendInput(e.target.value)}
            placeholder={gameId}
            className="w-full max-w-md rounded border border-white/10 bg-[#1A1A1F] px-3 py-2 text-sm text-white"
          />
        </div>
      ) : null}
    </div>
  );
}
