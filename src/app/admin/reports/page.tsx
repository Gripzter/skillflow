"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import LoadingRing from "@/components/LoadingRing";

type ReportStatus = "new" | "reviewed" | "resolved";

interface Report {
  id: string;
  reporter_user_id: string;
  reporter_username: string | null;
  reported_user_id: string | null;
  reported_username: string | null;
  match_id: string | null;
  game_type: string | null;
  report_reason: string;
  report_comment: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  // enriched at load time (profiles lookup fallback)
  reporterName?: string;
  reportedName?: string;
}

interface MatchRow {
  id: string;
  game_type: string;
  player1_username: string | null;
  player2_username: string | null;
  stake_amount: number;
  platform_fee: number;
  total_pot: number;
  status: string;
  result: string | null;
  created_at: string;
  completed_at: string | null;
  player1_id: string | null;
  player2_id: string | null;
  bot_difficulty: string | null;
  connection_log: unknown | null;
}

const STATUS_STYLES: Record<ReportStatus, string> = {
  new: "bg-[#FFFF00]/10 text-[#FFFF00]",
  reviewed: "bg-yellow-500/10 text-yellow-400",
  resolved: "bg-green-500/10 text-green-400",
};

const GAME_LABELS: Record<string, string> = {
  chess: "Chess",
  "connect-4": "Connect 4",
  "reaction-duel": "Reaction Duel",
  "memory-match": "Memory Match",
  checkers: "Checkers",
  "spelling-bee": "Spelling Bee",
  trivia: "Trivia",
  "typing-race": "Typing Race",
  "8-ball-pool": "8 Ball Pool",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MatchDetail({ matchId }: { matchId: string }) {
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .maybeSingle();
      if (error) {
        setErr(error.message);
      } else {
        setMatch((data as MatchRow) ?? null);
      }
      setLoading(false);
    }
    load();
  }, [matchId]);

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
      <div className="h-3.5 w-3.5 animate-spin rounded-full border border-t-transparent border-[#9CA3AF]" />
      Loading match data…
    </div>
  );
  if (err) return <p className="text-sm text-red-400">{err}</p>;
  if (!match) return <p className="text-sm text-[#9CA3AF]">No match data found.</p>;

  const resultLabel =
    match.result === "player1_win" ? `${match.player1_username ?? "Player 1"} won` :
    match.result === "player2_win" ? `${match.player2_username ?? "Player 2"} won` :
    match.result === "draw" ? "Draw" :
    match.status === "in_progress" ? "In progress" : "—";

  const events: { label: string; value: string }[] = [
    { label: "Match ID", value: match.id },
    { label: "Game", value: GAME_LABELS[match.game_type] ?? match.game_type },
    { label: "Status", value: match.status },
    { label: "Result", value: resultLabel },
    { label: "Player 1", value: match.player1_username ?? match.player1_id?.slice(0, 8) ?? "—" },
    { label: "Player 2", value: match.player2_username ?? (match.player2_id ? match.player2_id.slice(0, 8) : "Opponent") },
    { label: "Stake", value: match.stake_amount != null ? `$${Number(match.stake_amount).toFixed(2)}` : "—" },
    { label: "Pot", value: match.total_pot != null ? `$${Number(match.total_pot).toFixed(2)}` : "—" },
    { label: "Platform Fee", value: match.platform_fee != null ? `$${Number(match.platform_fee).toFixed(2)}` : "—" },
    { label: "Bot Difficulty", value: match.bot_difficulty ?? (match.player2_id ? "N/A" : "gamer") },
    { label: "Started", value: fmt(match.created_at) },
    { label: "Completed", value: match.completed_at ? fmt(match.completed_at) : "—" },
  ];

  const connLog = match.connection_log
    ? (Array.isArray(match.connection_log) ? match.connection_log : [match.connection_log])
    : [];

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Match Data</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {events.map((e) => (
          <div key={e.label}>
            <p className="text-[10px] text-[#6B7280]">{e.label}</p>
            <p className="text-sm text-white font-mono">{e.value}</p>
          </div>
        ))}
      </div>

      {connLog.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Connection Log ({connLog.length} events)
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-white/5 bg-admin-bg p-3 space-y-1">
            {connLog.map((entry, i) => {
              const e = entry as Record<string, unknown>;
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 font-mono text-[#6B7280]">
                    {e.timestamp ? new Date(e.timestamp as number).toISOString().slice(11, 23) : `#${i}`}
                  </span>
                  <span className="text-[#9CA3AF]">
                    {e.event ? String(e.event) : JSON.stringify(e)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingStatus, setPendingStatus] = useState<Record<string, ReportStatus>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }

      const { data, error: err } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (err) {
        setError(
          err.code === "42P01"
            ? "Reports table not found. Run the migration below."
            : err.message
        );
        setLoading(false);
        return;
      }

      const reportData = (data ?? []) as Report[];

      if (reportData.length > 0) {
        // Primary: use usernames stored at report-submission time.
        // Fallback: profiles table lookup (may be blocked by RLS for some rows).
        const missingPids = Array.from(
          new Set(
            reportData
              .flatMap((r) => [
                !r.reporter_username ? r.reporter_user_id : null,
                !r.reported_username && r.reported_user_id ? r.reported_user_id : null,
              ])
              .filter(Boolean)
          )
        ) as string[];

        const pm = new Map<string, string>();
        if (missingPids.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", missingPids);
          (profiles ?? []).forEach((p) => pm.set(p.id, p.username));
        }

        reportData.forEach((r) => {
          r.reporterName =
            r.reporter_username ||
            pm.get(r.reporter_user_id) ||
            r.reporter_user_id.slice(0, 8);
          r.reportedName = r.reported_user_id
            ? (r.reported_username || pm.get(r.reported_user_id) || r.reported_user_id.slice(0, 8))
            : "—";
        });
      }

      setReports(reportData);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(
    () => (statusFilter === "all" ? reports : reports.filter((r) => r.status === statusFilter)),
    [reports, statusFilter]
  );

  const counts = useMemo(() => ({
    new: reports.filter((r) => r.status === "new").length,
    reviewed: reports.filter((r) => r.status === "reviewed").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
  }), [reports]);

  async function saveReport(id: string) {
    const newStatus = pendingStatus[id] ?? reports.find((r) => r.id === id)?.status ?? "new";
    setSaving(id);
    const supabase = createClient();
    if (!supabase) { setSaving(null); return; }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status: newStatus,
      admin_notes: notes[id] ?? reports.find((r) => r.id === id)?.admin_notes ?? null,
      updated_at: now,
    };
    if (newStatus === "resolved") update.resolved_at = now;

    const { error: err } = await supabase.from("reports").update(update).eq("id", id);
    if (!err) {
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...update, status: newStatus } : r))
      );
    }
    setSaving(null);
  }

  if (loading) {
    return <LoadingRing />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        {error && (
          <span className="rounded bg-yellow-500/10 px-3 py-1.5 text-sm text-yellow-400">
            {error}
          </span>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {(["all", "new", "reviewed", "resolved"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s
                ? "text-white"
                : "bg-white/5 text-[#9CA3AF] hover:bg-white/10"
            }`}
            style={statusFilter === s ? { background: "#FFFF00", color: "#0E0E12" } : {}}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && (
              <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-xs">
                {counts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Report list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-admin-card p-12 text-center">
          <p className="text-[#9CA3AF]">
            {error ? "Create the reports table to start tracking player reports." : "No reports yet."}
          </p>
          {error && (
            <pre className="mx-auto mt-4 max-w-2xl rounded-lg bg-admin-bg p-4 text-left text-xs text-[#9CA3AF]">
{`-- Run in Supabase SQL editor:
CREATE TABLE IF NOT EXISTS reports (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_user_id  uuid        REFERENCES auth.users(id) NOT NULL,
  reporter_username text,
  reported_user_id  uuid        REFERENCES auth.users(id),
  reported_username text,
  match_id          uuid,
  game_type         text,
  report_reason     text        NOT NULL,
  report_comment    text,
  status            text        NOT NULL DEFAULT 'new'
                                CHECK (status IN ('new','reviewed','resolved')),
  admin_notes       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz,
  resolved_at       timestamptz
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Players can insert their own reports
CREATE POLICY "reports_insert_own"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_user_id);

-- Admin can do everything (SELECT, UPDATE, DELETE)
CREATE POLICY "reports_admin_all"
  ON reports FOR ALL
  USING (auth.email() = 'aras.axmas@gmail.com')
  WITH CHECK (auth.email() = 'aras.axmas@gmail.com');

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();`}
            </pre>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const isExpanded = expandedId === r.id;
            const currentStatus = pendingStatus[r.id] ?? r.status;
            return (
              <div key={r.id} className="rounded-xl border border-white/5 bg-admin-card overflow-hidden">
                {/* Card header — click to expand */}
                <button
                  type="button"
                  className="flex w-full items-start gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                      {r.game_type && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-[#9CA3AF]">
                          {GAME_LABELS[r.game_type] ?? r.game_type}
                        </span>
                      )}
                      <span className="text-sm font-medium text-white">{r.report_reason}</span>
                    </div>
                    <p className="text-sm text-[#9CA3AF]">
                      <span className="text-white">{r.reporterName}</span>
                      {" reported "}
                      <span className="text-white">{r.reportedName}</span>
                    </p>
                    {r.report_comment && (
                      <p className="text-sm text-[#6B7280] line-clamp-2">{r.report_comment}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <p className="text-xs text-[#6B7280]">{fmt(r.created_at)}</p>
                    {r.match_id && (
                      <p className="font-mono text-[10px] text-[#4B5563]">
                        {r.match_id.slice(0, 8)}
                      </p>
                    )}
                    <svg
                      className={`ml-auto h-4 w-4 text-[#6B7280] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded detail view */}
                {isExpanded && (
                  <div className="border-t border-white/5 px-5 pb-6 pt-5 space-y-6">

                    {/* Reporter / reported details */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-[#6B7280]">Reporter</p>
                        <p className="mt-0.5 text-sm text-white">{r.reporterName}</p>
                        <p className="font-mono text-[10px] text-[#4B5563]">{r.reporter_user_id.slice(0, 12)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280]">Reported Player</p>
                        <p className="mt-0.5 text-sm text-white">{r.reportedName}</p>
                        {r.reported_user_id && (
                          <p className="font-mono text-[10px] text-[#4B5563]">{r.reported_user_id.slice(0, 12)}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280]">Report ID</p>
                        <p className="mt-0.5 font-mono text-xs text-white">{r.id}</p>
                        {r.resolved_at && (
                          <>
                            <p className="mt-1 text-xs text-[#6B7280]">Resolved</p>
                            <p className="text-xs text-white">{fmt(r.resolved_at)}</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Full comment */}
                    {r.report_comment && (
                      <div>
                        <p className="text-xs text-[#6B7280]">Full Comment</p>
                        <p className="mt-1 text-sm text-white whitespace-pre-wrap">{r.report_comment}</p>
                      </div>
                    )}

                    {/* Match data */}
                    {r.match_id && (
                      <div className="rounded-lg border border-white/5 bg-admin-bg p-4">
                        <MatchDetail matchId={r.match_id} />
                      </div>
                    )}

                    {/* Admin controls */}
                    <div className="space-y-3 rounded-lg border border-white/5 bg-white/[0.02] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Admin Actions</p>
                      <div className="flex flex-wrap items-start gap-4">
                        <div className="flex-1 min-w-[160px]">
                          <label className="mb-1 block text-xs text-[#6B7280]">Status</label>
                          <select
                            value={currentStatus}
                            onChange={(e) =>
                              setPendingStatus((prev) => ({
                                ...prev,
                                [r.id]: e.target.value as ReportStatus,
                              }))
                            }
                            className="w-full rounded-lg border border-white/10 bg-admin-bg px-3 py-2 text-sm text-white focus:border-[#FFFF00] focus:outline-none"
                          >
                            <option value="new">New</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>
                        <div className="flex-[3] min-w-[200px]">
                          <label className="mb-1 block text-xs text-[#6B7280]">Admin Notes</label>
                          <textarea
                            rows={2}
                            value={notes[r.id] ?? r.admin_notes ?? ""}
                            onChange={(e) =>
                              setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                            className="w-full resize-none rounded-lg border border-white/10 bg-admin-bg px-3 py-2 text-sm text-white placeholder-[#6B7280] focus:border-[#FFFF00] focus:outline-none"
                            placeholder="Add internal notes…"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={saving === r.id}
                        onClick={() => saveReport(r.id)}
                        className="rounded-lg px-5 py-2 text-sm font-bold text-black disabled:opacity-50 hover:opacity-90 transition-opacity"
                        style={{ background: "#FFFF00" }}
                      >
                        {saving === r.id ? "Saving…" : "Save Changes"}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
