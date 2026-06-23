"use client";

import type { ExternalMatch } from "@/lib/external-matches";

interface DisputePanelProps {
  match: ExternalMatch;
  isDevMode: boolean;
  onResolve: (winnerId: "player1" | "player2") => void;
}

export default function DisputePanel({ match, isDevMode, onResolve }: DisputePanelProps) {
  const p1Result = match.player1Result;
  const p2Result = match.player2Result;

  return (
    <div className="card-border rounded-card bg-card p-6">
      <h3 className="text-xl font-bold text-amber-400"> Result Disputed</h3>
      <p className="mt-2 text-body-gray">
        Both players reported different outcomes. Our team will review the evidence and resolve this
        dispute within 24 hours. Stakes are held until resolution.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-[#1A1D27] p-4">
          <p className="font-semibold text-white">{match.player1.username} reported:</p>
          <p className="mt-1 text-body-gray">
            {p1Result
              ? p1Result.winner === "self"
                ? "I Won"
                : p1Result.winner === "opponent"
                  ? "I Lost"
                  : "Draw / No Result"
              : "—"}
            {p1Result?.score && ` (${p1Result.score})`}
          </p>
          {p1Result?.proofUrl && (
            <p className="mt-2 text-xs text-body-gray">Proof: {p1Result.proofUrl}</p>
          )}
        </div>
        <div className="rounded-lg border border-white/10 bg-[#1A1D27] p-4">
          <p className="font-semibold text-white">{match.player2.username} reported:</p>
          <p className="mt-1 text-body-gray">
            {p2Result
              ? p2Result.winner === "self"
                ? "I Won"
                : p2Result.winner === "opponent"
                  ? "I Lost"
                  : "Draw / No Result"
              : "—"}
            {p2Result?.score && ` (${p2Result.score})`}
          </p>
          {p2Result?.proofUrl && (
            <p className="mt-2 text-xs text-body-gray">Proof: {p2Result.proofUrl}</p>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm text-body-gray">
        Evidence from both sides will be reviewed by our moderation team. You will be notified when
        the dispute is resolved.
      </p>

      {isDevMode && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs font-medium text-purple">DEV ONLY — Resolve Dispute</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onResolve("player1")}
              className="rounded-lg border border-purple/50 bg-purple/20 px-4 py-2 text-sm text-purple hover:bg-purple/30"
            >
              Award to {match.player1.username}
            </button>
            <button
              type="button"
              onClick={() => onResolve("player2")}
              className="rounded-lg border border-purple/50 bg-purple/20 px-4 py-2 text-sm text-purple hover:bg-purple/30"
            >
              Award to {match.player2.username}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
