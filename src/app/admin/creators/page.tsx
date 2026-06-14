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

type InviteRow = {
  id: string;
  token: string;
  tokenShort: string;
  email: string | null;
  gameNameHint: string | null;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByName: string;
  createdAt: string;
};

type PendingAction = {
  gameId: string;
  gameName: string;
  action: "approve" | "suspend" | "reactivate";
  nextStatus: string;
};

type Tab = "creators" | "invites";

export default function AdminCreatorsPage() {
  const [tab, setTab] = useState<Tab>("creators");
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [saving, setSaving] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGameHint, setInviteGameHint] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokeToken, setRevokeToken] = useState<string | null>(null);

  const loadCreators = useCallback(async () => {
    const params = new URLSearchParams({ status, search });
    const res = await adminFetch<{ creators: CreatorRow[] }>(
      `/api/admin/creators?${params}`
    );
    setCreators(res.creators);
  }, [status, search]);

  const loadInvites = useCallback(async () => {
    const res = await adminFetch<{ invites: InviteRow[] }>("/api/admin/invites");
    setInvites(res.invites);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadCreators(), loadInvites()]);
    } finally {
      setLoading(false);
    }
  }, [loadCreators, loadInvites]);

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

  async function generateInvite() {
    setInviteGenerating(true);
    setInviteUrl(null);
    try {
      const res = await adminFetch<{ inviteUrl: string }>("/api/admin/invites", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim() || undefined,
          gameNameHint: inviteGameHint.trim() || undefined,
        }),
      });
      setInviteUrl(res.inviteUrl);
      void loadInvites();
    } finally {
      setInviteGenerating(false);
    }
  }

  async function copyInviteUrl() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function revokeInvite(token: string) {
    await adminFetch("/api/admin/invites", {
      method: "PATCH",
      body: JSON.stringify({ token }),
    });
    setRevokeToken(null);
    void loadInvites();
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <AdminPageHeader title="creators" />
        <button
          type="button"
          onClick={() => {
            setInviteOpen(true);
            setInviteUrl(null);
            setInviteEmail("");
            setInviteGameHint("");
          }}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold lowercase text-black"
          style={{ background: "#FFFF00" }}
        >
          invite creator
        </button>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("creators")}
          className={`rounded-lg px-4 py-2 text-sm lowercase ${
            tab === "creators"
              ? "bg-[#FFFF00] text-black"
              : "border border-white/10 text-[#C8C8D4]"
          }`}
        >
          creators
        </button>
        <button
          type="button"
          onClick={() => setTab("invites")}
          className={`rounded-lg px-4 py-2 text-sm lowercase ${
            tab === "invites"
              ? "bg-[#FFFF00] text-black"
              : "border border-white/10 text-[#C8C8D4]"
          }`}
        >
          pending invites
        </button>
      </div>

      {tab === "creators" ? (
        <>
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
        </>
      ) : loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
        </div>
      ) : (
        <AdminTableShell>
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">token</th>
                <th className="px-4 py-3">email</th>
                <th className="px-4 py-3">game hint</th>
                <th className="px-4 py-3">status</th>
                <th className="px-4 py-3">expires</th>
                <th className="px-4 py-3">accepted by</th>
                <th className="px-4 py-3">actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv, i) => (
                <tr key={inv.id} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                  <td className="px-4 py-3 font-mono text-xs">{inv.tokenShort}</td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{inv.email ?? "—"}</td>
                  <td className="px-4 py-3">{inv.gameNameHint ?? "—"}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-[#C8C8D4]">
                    {new Date(inv.expiresAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{inv.acceptedByName}</td>
                  <td className="px-4 py-3">
                    {inv.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => setRevokeToken(inv.token)}
                        className="rounded bg-red-500/20 px-2 py-1 text-xs lowercase text-red-400"
                      >
                        revoke
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      )}

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1A1A1F] p-6">
            <h3 className="text-lg font-semibold lowercase text-white">generate invite</h3>
            <p className="mt-2 text-sm text-[#7A7A8E]">
              Send this link to the creator. It expires in 7 days.
            </p>

            <div className="mt-4 space-y-3">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email (optional)"
                className="w-full rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
              />
              <input
                value={inviteGameHint}
                onChange={(e) => setInviteGameHint(e.target.value)}
                placeholder="game name hint (optional)"
                className="w-full rounded border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
              />
            </div>

            {inviteUrl ? (
              <div className="mt-4 rounded border border-[#FFFF00]/30 bg-[#0E0E12] p-3">
                <p className="mb-2 text-xs lowercase text-[#7A7A8E]">invite url</p>
                <code className="block break-all text-xs text-[#FFFF00]">{inviteUrl}</code>
                <button
                  type="button"
                  onClick={() => void copyInviteUrl()}
                  className="mt-3 rounded px-3 py-1.5 text-xs lowercase text-black"
                  style={{ background: "#FFFF00" }}
                >
                  {copied ? "copied" : "copy link"}
                </button>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded border border-white/10 px-4 py-2 text-sm lowercase text-[#C8C8D4]"
              >
                close
              </button>
              <button
                type="button"
                disabled={inviteGenerating}
                onClick={() => void generateInvite()}
                className="rounded px-4 py-2 text-sm font-medium lowercase text-black disabled:opacity-50"
                style={{ background: "#FFFF00" }}
              >
                {inviteGenerating ? "generating…" : inviteUrl ? "generate another" : "generate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

      <AdminConfirmModal
        open={!!revokeToken}
        title="revoke invite"
        message="This invite link will no longer work. Are you sure?"
        confirmLabel="revoke"
        confirmTone="danger"
        onCancel={() => setRevokeToken(null)}
        onConfirm={() => revokeToken && void revokeInvite(revokeToken)}
      />
    </div>
  );
}
