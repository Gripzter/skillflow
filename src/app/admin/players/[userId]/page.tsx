"use client";

import { useCallback, useEffect, useState } from "react";
import AdminConfirmModal, {
  AdminPageHeader,
  AdminTableShell,
  MoneyPair,
  RelativeTime,
  RiskBadge,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";

type PlayerData = {
  player: {
    id: string;
    username: string;
    email: string;
    banned: boolean;
    suspicious: boolean;
    country: string;
    countryFlag: string;
    balanceSK: number;
    balanceUSD: number;
    totalMatches: number;
    wins: number;
    winRate: number;
    totalWageredSK: number;
    totalDepositedUSD: number;
    totalWithdrawnUSD: number;
    joinedAt: string;
    lastActive: string;
  };
  matchHistory: Array<{
    id: string;
    date: string;
    game: string;
    opponent: string;
    entrySK: number;
    result: string;
    earningsSK: number;
    durationSec: number | null;
    suspicious: boolean;
  }>;
  financialHistory: Array<{
    id: string;
    date: string;
    type: string;
    amountUSD: number;
    status: string;
    transactionId: string;
    balanceAfterSK: number;
  }>;
  sessions: Array<{
    id: string;
    ip: string | null;
    user_agent: string | null;
    created_at: string;
    sharedIp: boolean;
  }>;
  notes: Array<{
    id: string;
    note: string;
    created_by: string;
    created_at: string;
  }>;
  cheatAnalysis: {
    winRate: number;
    platformAvgWinRate: number;
    flags: Array<{
      id: string;
      flag_type: string;
      severity: string;
      details: string | null;
      reviewed: boolean;
      created_at: string;
    }>;
    sharedIpCount: number;
  };
  adjustments: Array<{
    id: string;
    amount_sk: number;
    reason: string;
    created_at: string;
  }>;
};

const TABS = ["matches", "financial", "sessions", "notes", "cheat analysis"] as const;
type Tab = (typeof TABS)[number];

export default function AdminPlayerDetailPage({
  params,
}: {
  params: { userId: string };
}) {
  const userId = params.userId;
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("matches");
  const [pendingBan, setPendingBan] = useState<boolean | null>(null);
  const [pendingSuspicious, setPendingSuspicious] = useState<boolean | null>(null);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceReason, setBalanceReason] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<PlayerData>(`/api/admin/players/${userId}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchPlayer(updates: { banned?: boolean; suspicious?: boolean }) {
    await adminFetch(`/api/admin/players/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    void load();
  }

  async function adjustBalance() {
    const amount = Number(balanceAmount);
    if (!amount || !balanceReason.trim()) return;
    setBalanceLoading(true);
    try {
      await adminFetch(`/api/admin/players/${userId}/balance`, {
        method: "POST",
        body: JSON.stringify({ amountSK: amount, reason: balanceReason.trim() }),
      });
      setBalanceOpen(false);
      setBalanceAmount("");
      setBalanceReason("");
      void load();
    } finally {
      setBalanceLoading(false);
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setNoteLoading(true);
    try {
      await adminFetch(`/api/admin/players/${userId}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: newNote.trim() }),
      });
      setNewNote("");
      void load();
    } finally {
      setNoteLoading(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  const p = data?.player;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AdminPageHeader
          title={`${p?.countryFlag ?? ""} ${p?.username ?? "player"}`}
          subtitle={p?.email}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPendingBan(!(p?.banned ?? false))}
            className={`rounded px-3 py-1.5 text-xs lowercase ${
              p?.banned ? "bg-[#FFFF00]/20 text-[#FFFF00]" : "bg-red-500/20 text-red-400"
            }`}
          >
            {p?.banned ? "unban" : "ban"}
          </button>
          <button
            type="button"
            onClick={() => setPendingSuspicious(!(p?.suspicious ?? false))}
            className={`rounded px-3 py-1.5 text-xs lowercase ${
              p?.suspicious
                ? "bg-white/10 text-[#C8C8D4]"
                : "bg-orange-500/20 text-orange-400"
            }`}
          >
            {p?.suspicious ? "clear suspicious" : "mark suspicious"}
          </button>
          <button
            type="button"
            onClick={() => setBalanceOpen(true)}
            className="rounded px-3 py-1.5 text-xs lowercase text-black"
            style={{ background: "#FFFF00" }}
          >
            adjust balance
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-4">
          <p className="text-xs lowercase text-[#7A7A8E]">balance</p>
          <div className="mt-2">
            {p ? <MoneyPair sk={p.balanceSK} usd={p.balanceUSD} /> : null}
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-4">
          <p className="text-xs lowercase text-[#7A7A8E]">win rate</p>
          <p className="mt-2 text-xl text-white">{p?.winRate ?? 0}%</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-4">
          <p className="text-xs lowercase text-[#7A7A8E]">total wagered</p>
          <p className="mt-2 text-xl text-[#FFFF00]">{p?.totalWageredSK ?? 0} sk</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-4">
          <p className="text-xs lowercase text-[#7A7A8E]">status</p>
          <p className="mt-2 text-lg lowercase text-white">
            {p?.banned ? "banned" : p?.suspicious ? "suspicious" : "active"}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-4">
          <p className="text-xs lowercase text-[#7A7A8E]">matches</p>
          <p className="mt-2 text-xl text-white">{p?.totalMatches ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-4">
          <p className="text-xs lowercase text-[#7A7A8E]">deposited</p>
          <p className="mt-2 text-xl text-white">${p?.totalDepositedUSD.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-4">
          <p className="text-xs lowercase text-[#7A7A8E]">withdrawn</p>
          <p className="mt-2 text-xl text-white">${p?.totalWithdrawnUSD.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-4">
          <p className="text-xs lowercase text-[#7A7A8E]">last active</p>
          <p className="mt-2 text-sm text-[#C8C8D4]">
            {p?.lastActive ? <RelativeTime iso={p.lastActive} /> : "—"}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-white/5 pb-3">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm lowercase ${
              tab === t
                ? "bg-[#FFFF00] text-black"
                : "border border-white/10 text-[#C8C8D4] hover:bg-white/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "matches" ? (
        <AdminTableShell>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">date</th>
                <th className="px-4 py-3">game</th>
                <th className="px-4 py-3">opponent</th>
                <th className="px-4 py-3">entry</th>
                <th className="px-4 py-3">result</th>
                <th className="px-4 py-3">earnings</th>
                <th className="px-4 py-3">duration</th>
              </tr>
            </thead>
            <tbody>
              {(data?.matchHistory ?? []).map((m, i) => (
                <tr
                  key={m.id}
                  onClick={() => {
                    window.location.href = `/admin/matches/${m.id}`;
                  }}
                  className={`cursor-pointer ${i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"} hover:bg-white/5`}
                >
                  <td className="px-4 py-3 text-[#C8C8D4]">
                    <RelativeTime iso={m.date} />
                  </td>
                  <td className="px-4 py-3">{m.game}</td>
                  <td className="px-4 py-3">{m.opponent}</td>
                  <td className="px-4 py-3 text-[#FFFF00]">{m.entrySK} sk</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        m.result === "won"
                          ? "text-emerald-400"
                          : m.result === "lost"
                            ? "text-red-400"
                            : "text-[#7A7A8E]"
                      }
                    >
                      {m.result}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={m.earningsSK >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {m.earningsSK >= 0 ? "+" : ""}
                      {m.earningsSK} sk
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#C8C8D4]">
                    {m.durationSec == null ? "—" : `${m.durationSec}s`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      ) : null}

      {tab === "financial" ? (
        <>
          <AdminTableShell>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                  <th className="px-4 py-3">date</th>
                  <th className="px-4 py-3">type</th>
                  <th className="px-4 py-3">amount</th>
                  <th className="px-4 py-3">balance after</th>
                  <th className="px-4 py-3">status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.financialHistory ?? []).map((t, i) => (
                  <tr key={t.id} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                    <td className="px-4 py-3 text-[#C8C8D4]">
                      <RelativeTime iso={t.date} />
                    </td>
                    <td className="px-4 py-3">{t.type}</td>
                    <td
                      className={`px-4 py-3 ${t.amountUSD >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {t.amountUSD >= 0 ? "+" : ""}${Math.abs(t.amountUSD).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-[#FFFF00]">{t.balanceAfterSK} sk</td>
                    <td className="px-4 py-3">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>
          {(data?.adjustments ?? []).length > 0 ? (
            <div className="mt-6 rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
              <h3 className="mb-3 text-sm lowercase text-[#C8C8D4]">admin adjustments</h3>
              <ul className="space-y-2 text-sm">
                {data!.adjustments.map((a) => (
                  <li key={a.id} className="flex justify-between text-[#C8C8D4]">
                    <span>
                      {a.amount_sk >= 0 ? "+" : ""}
                      {a.amount_sk} sk — {a.reason}
                    </span>
                    <RelativeTime iso={a.created_at} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "sessions" ? (
        <AdminTableShell>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">time</th>
                <th className="px-4 py-3">ip</th>
                <th className="px-4 py-3">user agent</th>
                <th className="px-4 py-3">shared ip</th>
              </tr>
            </thead>
            <tbody>
              {(data?.sessions ?? []).map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                  <td className="px-4 py-3 text-[#C8C8D4]">
                    <RelativeTime iso={s.created_at} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.ip ?? "—"}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-[#7A7A8E]">
                    {s.user_agent ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.sharedIp ? (
                      <span className="text-orange-400">⚠ yes</span>
                    ) : (
                      <span className="text-[#7A7A8E]">no</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      ) : null}

      {tab === "notes" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="add admin note…"
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              disabled={!newNote.trim() || noteLoading}
              onClick={() => void addNote()}
              className="mt-3 rounded px-4 py-2 text-sm lowercase text-black disabled:opacity-40"
              style={{ background: "#FFFF00" }}
            >
              {noteLoading ? "saving…" : "add note"}
            </button>
          </div>
          <div className="space-y-3">
            {(data?.notes ?? []).map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-white/10 bg-[#0E0E12] p-4"
              >
                <p className="text-sm text-white">{n.note}</p>
                <p className="mt-2 text-xs text-[#7A7A8E]">
                  <RelativeTime iso={n.created_at} />
                </p>
              </div>
            ))}
            {(data?.notes ?? []).length === 0 ? (
              <p className="text-sm text-[#7A7A8E]">no notes yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "cheat analysis" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
              <p className="text-xs lowercase text-[#7A7A8E]">player win rate</p>
              <p className="mt-2 text-2xl text-white">
                {data?.cheatAnalysis.winRate.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
              <p className="text-xs lowercase text-[#7A7A8E]">platform avg</p>
              <p className="mt-2 text-2xl text-[#C8C8D4]">
                {data?.cheatAnalysis.platformAvgWinRate}%
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
              <p className="text-xs lowercase text-[#7A7A8E]">shared ip accounts</p>
              <p className="mt-2 text-2xl text-orange-400">
                {data?.cheatAnalysis.sharedIpCount ?? 0}
              </p>
            </div>
          </div>

          <AdminTableShell>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                  <th className="px-4 py-3">type</th>
                  <th className="px-4 py-3">severity</th>
                  <th className="px-4 py-3">details</th>
                  <th className="px-4 py-3">reviewed</th>
                  <th className="px-4 py-3">date</th>
                </tr>
              </thead>
              <tbody>
                {(data?.cheatAnalysis.flags ?? []).map((f, i) => (
                  <tr key={f.id} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                    <td className="px-4 py-3">{f.flag_type}</td>
                    <td className="px-4 py-3">
                      <RiskBadge
                        level={
                          f.severity === "high"
                            ? "high"
                            : f.severity === "medium"
                              ? "medium"
                              : "low"
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-[#C8C8D4]">{f.details ?? "—"}</td>
                    <td className="px-4 py-3">{f.reviewed ? "yes" : "no"}</td>
                    <td className="px-4 py-3 text-[#C8C8D4]">
                      <RelativeTime iso={f.created_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>
          {(data?.cheatAnalysis.flags ?? []).length === 0 ? (
            <p className="text-sm text-[#7A7A8E]">no cheat flags on record.</p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          window.location.href = "/admin/players";
        }}
        className="mt-6 rounded border border-white/10 px-4 py-2 text-sm lowercase text-[#C8C8D4]"
      >
        back to players
      </button>

      <AdminConfirmModal
        open={pendingBan !== null}
        title={pendingBan ? "ban player" : "unban player"}
        message={`Are you sure you want to ${pendingBan ? "ban" : "unban"} ${p?.username}?`}
        confirmLabel={pendingBan ? "ban" : "unban"}
        confirmTone={pendingBan ? "danger" : "warning"}
        onCancel={() => setPendingBan(null)}
        onConfirm={() => {
          if (pendingBan !== null) {
            void patchPlayer({ banned: pendingBan }).then(() => setPendingBan(null));
          }
        }}
      />

      <AdminConfirmModal
        open={pendingSuspicious !== null}
        title={pendingSuspicious ? "mark suspicious" : "clear suspicious"}
        message={`${pendingSuspicious ? "Mark" : "Clear"} suspicious flag for ${p?.username}?`}
        confirmLabel={pendingSuspicious ? "mark" : "clear"}
        confirmTone="warning"
        onCancel={() => setPendingSuspicious(null)}
        onConfirm={() => {
          if (pendingSuspicious !== null) {
            void patchPlayer({ suspicious: pendingSuspicious }).then(() =>
              setPendingSuspicious(null)
            );
          }
        }}
      />

      {balanceOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1A1A1F] p-6">
            <h3 className="text-lg font-semibold lowercase text-white">adjust balance</h3>
            <p className="mt-2 text-sm text-[#7A7A8E]">
              positive to credit, negative to debit (sk)
            </p>
            <input
              type="number"
              value={balanceAmount}
              onChange={(e) => setBalanceAmount(e.target.value)}
              placeholder="amount sk"
              className="mt-4 w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
            />
            <input
              value={balanceReason}
              onChange={(e) => setBalanceReason(e.target.value)}
              placeholder="reason (required)"
              className="mt-3 w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setBalanceOpen(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm lowercase text-[#C8C8D4]"
              >
                cancel
              </button>
              <button
                type="button"
                disabled={!balanceAmount || !balanceReason.trim() || balanceLoading}
                onClick={() => void adjustBalance()}
                className="rounded-lg bg-[#FFFF00] px-4 py-2 text-sm lowercase text-black disabled:opacity-40"
              >
                {balanceLoading ? "working…" : "apply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
