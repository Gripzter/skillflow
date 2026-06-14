"use client";

import { useCallback, useEffect, useState } from "react";
import AdminConfirmModal, {
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
  MoneyPair,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";

type CreatorRow = {
  id: string;
  creatorId: string;
  creatorName: string;
  email: string;
  gameName: string;
  gameId: string;
  status: string;
  totalMatches: number;
  totalEarnedSK: number;
  totalEarnedUSD: number;
  joinedAt: string;
};

type PendingAction = {
  gameId: string;
  gameName: string;
  action: "approve" | "suspend" | "reactivate";
  nextStatus: string;
};

export default function AdminCreatorsPage() {
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, search });
      const res = await adminFetch<{ creators: CreatorRow[] }>(
        `/api/admin/creators?${params}`
      );
      setCreators(res.creators);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  async function applyStatus(action: PendingAction) {
    setSaving(true);
    const prev = creators;
    setCreators((rows) =>
      rows.map((r) =>
        r.gameId === action.gameId ? { ...r, status: action.nextStatus } : r
      )
    );

    try {
      await adminFetch("/api/admin/creators", {
        method: "PATCH",
        body: JSON.stringify({ gameId: action.gameId, status: action.nextStatus }),
      });
    } catch {
      setCreators(prev);
    } finally {
      setSaving(false);
      setPending(null);
    }
  }

  return (
    <div>
      <AdminPageHeader title="creators" />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search name or game_id"
          className="rounded-lg border border-white/10 bg-[#1A1A1F] px-3 py-2 text-sm text-white"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#1A1A1F] px-3 py-2 text-sm text-white"
        >
          <option value="all">all statuses</option>
          <option value="pending">pending</option>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
        </div>
      ) : (
        <AdminTableShell>
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">creator</th>
                <th className="px-4 py-3">email</th>
                <th className="px-4 py-3">game</th>
                <th className="px-4 py-3">game_id</th>
                <th className="px-4 py-3">status</th>
                <th className="px-4 py-3">matches</th>
                <th className="px-4 py-3">earned</th>
                <th className="px-4 py-3">joined</th>
                <th className="px-4 py-3">actions</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                  <td className="px-4 py-3">{c.creatorName}</td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{c.email}</td>
                  <td className="px-4 py-3">{c.gameName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#FFFF00]">{c.gameId}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">{c.totalMatches}</td>
                  <td className="px-4 py-3">
                    <MoneyPair sk={c.totalEarnedSK} usd={c.totalEarnedUSD} />
                  </td>
                  <td className="px-4 py-3 text-[#C8C8D4]">
                    {new Date(c.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {c.status === "pending" ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPending({
                              gameId: c.gameId,
                              gameName: c.gameName,
                              action: "approve",
                              nextStatus: "active",
                            })
                          }
                          className="rounded bg-emerald-500/20 px-2 py-1 text-xs lowercase text-emerald-400"
                        >
                          approve
                        </button>
                      ) : null}
                      {c.status === "active" ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPending({
                              gameId: c.gameId,
                              gameName: c.gameName,
                              action: "suspend",
                              nextStatus: "suspended",
                            })
                          }
                          className="rounded bg-red-500/20 px-2 py-1 text-xs lowercase text-red-400"
                        >
                          suspend
                        </button>
                      ) : null}
                      {c.status === "suspended" ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPending({
                              gameId: c.gameId,
                              gameName: c.gameName,
                              action: "reactivate",
                              nextStatus: "active",
                            })
                          }
                          className="rounded bg-[#FFFF00]/20 px-2 py-1 text-xs lowercase text-[#FFFF00]"
                        >
                          reactivate
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = `/admin/creators/${encodeURIComponent(c.gameId)}`;
                        }}
                        className="rounded border border-white/10 px-2 py-1 text-xs lowercase text-[#C8C8D4]"
                      >
                        view
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      )}

      <AdminConfirmModal
        open={!!pending}
        title={`${pending?.action} creator`}
        message={`Are you sure you want to ${pending?.action} ${pending?.gameName}?`}
        confirmLabel={pending?.action}
        confirmTone={pending?.action === "suspend" ? "danger" : "warning"}
        loading={saving}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && void applyStatus(pending)}
      />
    </div>
  );
}
