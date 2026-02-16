"use client";

import { useState } from "react";

interface DisputeReport {
  player: string;
  claimed: string;
  score: string;
  proof: string;
  connectionQuality: string;
  winRate: number;
  disputesFiled: number;
}

interface Dispute {
  id: string;
  matchId: string;
  game: string;
  date: string;
  stake: number;
  platformFee: number;
  player1: DisputeReport;
  player2: DisputeReport;
  scenario: string;
}

const FAKE_DISPUTES: Dispute[] = [
  {
    id: "d1",
    matchId: "m-a1b2c3d4",
    game: "8 Ball Pool",
    date: new Date(Date.now() - 2 * 3600000).toISOString(),
    stake: 25,
    platformFee: 1.5,
    scenario: "Both claim they won",
    player1: {
      player: "PoolShark",
      claimed: "I won 5-3",
      score: "5-3",
      proof: "Screenshot of final score",
      connectionQuality: "Good (avg 28ms)",
      winRate: 62,
      disputesFiled: 0,
    },
    player2: {
      player: "xKiller99",
      claimed: "I won 5-2, he disconnected",
      score: "5-2",
      proof: "Screenshot showing victory",
      connectionQuality: "Fair (avg 85ms)",
      winRate: 48,
      disputesFiled: 2,
    },
  },
  {
    id: "d2",
    matchId: "m-e5f6g7h8",
    game: "Chess",
    date: new Date(Date.now() - 5 * 3600000).toISOString(),
    stake: 10,
    platformFee: 0.6,
    scenario: "Connection issues caused loss",
    player1: {
      player: "ChessMaster",
      claimed: "I was winning but had 3% packet loss — game froze",
      score: "Resignation",
      proof: "Connection log showing packet loss spike",
      connectionQuality: "Poor during match (packet loss 3%)",
      winRate: 55,
      disputesFiled: 1,
    },
    player2: {
      player: "SniperElite",
      claimed: "I won fairly, he resigned",
      score: "1-0 (resignation)",
      proof: "Game log",
      connectionQuality: "Good (12ms)",
      winRate: 58,
      disputesFiled: 0,
    },
  },
  {
    id: "d3",
    matchId: "m-i9j0k1l2",
    game: "CS2 (External)",
    date: new Date(Date.now() - 24 * 3600000).toISOString(),
    stake: 50,
    platformFee: 3,
    scenario: "One player never reported results",
    player1: {
      player: "NoScope360",
      claimed: "I won 13-8, opponent never submitted result",
      score: "13-8",
      proof: "Steam match history link",
      connectionQuality: "Good",
      winRate: 52,
      disputesFiled: 0,
    },
    player2: {
      player: "EzWin",
      claimed: "Abandoned — no response",
      score: "N/A",
      proof: "None",
      connectionQuality: "N/A",
      winRate: 45,
      disputesFiled: 3,
    },
  },
];

const GUIDELINES = [
  "If both screenshots agree → award to screenshot winner",
  "If connection logs show one player had severe issues → consider voiding",
  "If one player has history of disputes → consider with caution",
  "If insufficient evidence → void match and refund",
];

export default function AdminDisputesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(FAKE_DISPUTES[0]?.id ?? null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const selected = FAKE_DISPUTES.find((d) => d.id === selectedId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dispute Resolution</h1>

      <div className="rounded-xl border border-white/5 bg-admin-card p-4">
        <p className="text-admin-body">
          <strong className="text-admin-danger">{FAKE_DISPUTES.length}</strong> disputes awaiting resolution.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* List */}
        <div className="lg:col-span-1">
          <h2 className="mb-3 text-lg font-semibold text-white">Disputes</h2>
          <ul className="space-y-2">
            {FAKE_DISPUTES.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                    selectedId === d.id
                      ? "border-admin-accent bg-admin-accent/10 text-white"
                      : "border-white/10 text-admin-body hover:bg-white/5"
                  }`}
                >
                  <span className="font-medium">{d.game}</span> — ${d.stake} · {d.scenario.slice(0, 25)}…
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 space-y-6">
          {selected && (
            <>
              <div className="rounded-xl border border-white/5 bg-admin-card p-6">
                <h2 className="text-lg font-semibold text-white">Dispute: {selected.matchId}</h2>
                <p className="mt-1 text-admin-body">{selected.game} · ${selected.stake} stake · {new Date(selected.date).toLocaleString()}</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-admin-card p-6">
                  <h3 className="font-semibold text-white">Player 1: {selected.player1.player}</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div><dt className="text-admin-body">Reported result</dt><dd className="text-white">{selected.player1.claimed}</dd></div>
                    <div><dt className="text-admin-body">Score</dt><dd className="text-white">{selected.player1.score}</dd></div>
                    <div><dt className="text-admin-body">Evidence</dt><dd className="text-white">{selected.player1.proof}</dd></div>
                    <div><dt className="text-admin-body">Connection</dt><dd className="text-white">{selected.player1.connectionQuality}</dd></div>
                    <div><dt className="text-admin-body">Win rate / Disputes filed</dt><dd className="text-white">{selected.player1.winRate}% / {selected.player1.disputesFiled}</dd></div>
                  </dl>
                  <div className="mt-4 h-24 rounded border border-white/10 bg-admin-bg flex items-center justify-center text-admin-body text-sm">
                    Screenshot placeholder
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-admin-card p-6">
                  <h3 className="font-semibold text-white">Player 2: {selected.player2.player}</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div><dt className="text-admin-body">Reported result</dt><dd className="text-white">{selected.player2.claimed}</dd></div>
                    <div><dt className="text-admin-body">Score</dt><dd className="text-white">{selected.player2.score}</dd></div>
                    <div><dt className="text-admin-body">Evidence</dt><dd className="text-white">{selected.player2.proof}</dd></div>
                    <div><dt className="text-admin-body">Connection</dt><dd className="text-white">{selected.player2.connectionQuality}</dd></div>
                    <div><dt className="text-admin-body">Win rate / Disputes filed</dt><dd className="text-white">{selected.player2.winRate}% / {selected.player2.disputesFiled}</dd></div>
                  </dl>
                  <div className="mt-4 h-24 rounded border border-white/10 bg-admin-bg flex items-center justify-center text-admin-body text-sm">
                    Screenshot placeholder
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-admin-card p-6">
                <h3 className="font-semibold text-white">Resolution guidelines</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-admin-body">
                  {GUIDELINES.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-white/5 bg-admin-card p-6">
                <h3 className="font-semibold text-white">Admin actions</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="rounded bg-admin-accent px-4 py-2 text-sm font-medium text-white">
                    Award Win to Player 1
                  </button>
                  <button type="button" className="rounded bg-admin-accent px-4 py-2 text-sm font-medium text-white">
                    Award Win to Player 2
                  </button>
                  <button type="button" className="rounded bg-admin-warning/20 px-4 py-2 text-sm font-medium text-admin-warning">
                    Void Match — Refund Both
                  </button>
                  <button type="button" className="rounded border border-white/20 px-4 py-2 text-sm text-admin-body">
                    Escalate
                  </button>
                </div>
                <textarea
                  placeholder="Add resolution notes..."
                  value={notes[selected.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [selected.id]: e.target.value }))}
                  className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-admin-body focus:border-admin-accent focus:outline-none"
                  rows={3}
                />
                <button type="button" className="mt-3 rounded bg-admin-accent px-4 py-2 text-sm font-medium text-white">
                  Submit Decision
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
