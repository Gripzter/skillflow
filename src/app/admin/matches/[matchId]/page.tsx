"use client";

import { useCallback, useEffect, useState } from "react";
import AdminConfirmModal, {
  AdminPageHeader,
  AdminStatusBadge,
  MoneyPair,
  RelativeTime,
} from "@/components/admin/AdminShared";
import MatchTimeline from "@/components/admin/MatchTimeline";
import { adminFetch } from "@/lib/admin-client";

type Dispute = {
  id: string;
  match_id: string;
  submitted_by: string | null;
  reason: string;
  status: string;
  resolution: string | null;
  resolution_note: string | null;
  created_at: string;
};

type MatchDetail = {
  match: {
    id: string;
    idShort: string;
    game: string;
    player1Id: string | null;
    player2Id: string | null;
    player1: string;
    player2: string;
    entrySK: number;
    potSK: number;
    rakeSK: number;
    creatorCutSK: number;
    skillflowNetSK: number;
    skillflowNetUSD: number;
    winner: string;
    winnerId: string | null;
    status: string;
    durationSec: number | null;
    createdAt: string;
    completedAt: string | null;
    suspicious: boolean;
    suspiciousReasons: string[];
    hasEventData: boolean;
  };
  timeline: Array<{
    id: string;
    eventType: string;
    playerName: string | null;
    playerId: string | null;
    payload: unknown;
    reactionTimeMs: number | null;
    createdAt: string;
  }>;
  disputes: Dispute[];
};

export default function AdminMatchDetailPage({
  params,
}: {
  params: { matchId: string };
}) {
  const matchId = params.matchId;
  const [data, setData] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolution, setResolution] = useState("void_refund");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<MatchDetail>(`/api/admin/matches/${matchId}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveDispute() {
    if (!resolvingId || !resolutionNote.trim()) return;
    setSubmitting(true);
    try {
      await adminFetch(`/api/admin/matches/${matchId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "resolve_dispute",
          disputeId: resolvingId,
          resolution,
          resolutionNote: resolutionNote.trim(),
        }),
      });
      setResolvingId(null);
      setResolutionNote("");
      void load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  const m = data?.match;
  const openDisputes = (data?.disputes ?? []).filter((d) => d.status !== "resolved");

  return (
    <div>
      <AdminPageHeader
        title={`match ${m?.idShort ?? matchId.slice(0, 8)}`}
        subtitle={m?.game}
      />

      <div className="mb-6 rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <AdminStatusBadge status={m?.status ?? "unknown"} />
          {m?.suspicious ? (
            <span className="rounded-full border border-orange-500/30 bg-orange-500/15 px-2.5 py-0.5 text-xs text-orange-400">
              ⚠ suspicious{m.suspiciousReasons.length ? `: ${m.suspiciousReasons.join(", ")}` : ""}
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs lowercase text-[#7A7A8E]">player 1</dt>
            <dd className="mt-1">
              {m?.player1Id ? (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/admin/players/${m.player1Id}`;
                  }}
                  className="text-[#FFFF00] hover:underline"
                >
                  {m.player1}
                </button>
              ) : (
                <span className="text-white">{m?.player1}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs lowercase text-[#7A7A8E]">player 2</dt>
            <dd className="mt-1">
              {m?.player2Id ? (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/admin/players/${m.player2Id}`;
                  }}
                  className="text-[#FFFF00] hover:underline"
                >
                  {m.player2}
                </button>
              ) : (
                <span className="text-white">{m?.player2}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs lowercase text-[#7A7A8E]">winner</dt>
            <dd className="mt-1 text-white">{m?.winner}</dd>
          </div>
          <div>
            <dt className="text-xs lowercase text-[#7A7A8E]">entry</dt>
            <dd className="mt-1 text-[#FFFF00]">{m?.entrySK} sk</dd>
          </div>
          <div>
            <dt className="text-xs lowercase text-[#7A7A8E]">pot</dt>
            <dd className="mt-1 text-[#FFFF00]">{m?.potSK} sk</dd>
          </div>
          <div>
            <dt className="text-xs lowercase text-[#7A7A8E]">skillflow net</dt>
            <dd className="mt-1">
              {m ? <MoneyPair sk={m.skillflowNetSK} usd={m.skillflowNetUSD} /> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs lowercase text-[#7A7A8E]">rake</dt>
            <dd className="mt-1 text-white">{m?.rakeSK} sk</dd>
          </div>
          <div>
            <dt className="text-xs lowercase text-[#7A7A8E]">creator cut</dt>
            <dd className="mt-1 text-white">{m?.creatorCutSK} sk</dd>
          </div>
          <div>
            <dt className="text-xs lowercase text-[#7A7A8E]">duration</dt>
            <dd className="mt-1 text-white">
              {m?.durationSec == null ? "—" : `${m.durationSec.toFixed(1)}s`}
            </dd>
          </div>
          <div>
            <dt className="text-xs lowercase text-[#7A7A8E]">started</dt>
            <dd className="mt-1 text-[#C8C8D4]">
              {m?.createdAt ? <RelativeTime iso={m.createdAt} /> : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs lowercase text-[#7A7A8E]">completed</dt>
            <dd className="mt-1 text-[#C8C8D4]">
              {m?.completedAt ? new Date(m.completedAt).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
      </div>

      {openDisputes.length > 0 ? (
        <div className="mb-6 rounded-xl border border-orange-500/30 bg-orange-500/5 p-5">
          <h2 className="mb-4 text-sm font-medium lowercase text-orange-400">
            disputes ({openDisputes.length})
          </h2>
          <div className="space-y-4">
            {openDisputes.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-white/10 bg-[#0E0E12] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-white">{d.reason}</span>
                  <AdminStatusBadge status={d.status} />
                </div>
                <p className="mt-2 text-xs text-[#7A7A8E]">
                  filed <RelativeTime iso={d.created_at} />
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setResolvingId(d.id);
                    setResolutionNote("");
                  }}
                  className="mt-3 rounded px-3 py-1.5 text-xs lowercase text-black"
                  style={{ background: "#FFFF00" }}
                >
                  resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
        <h2 className="mb-4 text-sm lowercase text-[#C8C8D4]">match timeline</h2>
        <MatchTimeline
          events={data?.timeline ?? []}
          hasEventData={m?.hasEventData ?? false}
        />
      </div>

      <button
        type="button"
        onClick={() => {
          window.location.href = "/admin/matches";
        }}
        className="rounded border border-white/10 px-4 py-2 text-sm lowercase text-[#C8C8D4]"
      >
        back to matches
      </button>

      <AdminConfirmModal
        open={!!resolvingId}
        title="resolve dispute"
        message="Submit resolution for this dispute?"
        confirmLabel="resolve"
        loading={submitting}
        onCancel={() => setResolvingId(null)}
        onConfirm={() => void resolveDispute()}
      />
      {resolvingId ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1A1A1F] p-6">
            <h3 className="text-lg font-semibold lowercase text-white">resolve dispute</h3>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="mt-4 w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
            >
              <option value="void_refund">void — refund both</option>
              <option value="award_player1">award player 1</option>
              <option value="award_player2">award player 2</option>
              <option value="no_action">no action</option>
            </select>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="resolution notes (required)"
              rows={3}
              className="mt-3 w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResolvingId(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm lowercase text-[#C8C8D4]"
              >
                cancel
              </button>
              <button
                type="button"
                disabled={!resolutionNote.trim() || submitting}
                onClick={() => void resolveDispute()}
                className="rounded-lg bg-[#FFFF00] px-4 py-2 text-sm lowercase text-black disabled:opacity-40"
              >
                {submitting ? "working…" : "submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
