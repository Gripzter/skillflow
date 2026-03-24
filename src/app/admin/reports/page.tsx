"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";

type ReportStatus = "new" | "reviewed" | "resolved";

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  match_id: string | null;
  reason: string;
  description: string;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  admin_notes: string | null;
  // enriched
  reporterName?: string;
  reportedName?: string;
}

const STATUS_STYLES: Record<ReportStatus, string> = {
  new: "bg-[#FF5E00]/10 text-[#FF5E00]",
  reviewed: "bg-yellow-500/10 text-yellow-400",
  resolved: "bg-green-500/10 text-green-400",
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }

      const { data, error: err } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (err) {
        // Table may not exist yet
        setError(
          err.code === "42P01"
            ? "Reports table not found. Run the migration to create it."
            : err.message
        );
        setLoading(false);
        return;
      }

      const reportData = (data ?? []) as Report[];

      // Enrich with usernames
      if (reportData.length > 0) {
        const pids = Array.from(
          new Set(reportData.flatMap((r) => [r.reporter_id, r.reported_user_id].filter(Boolean)))
        ) as string[];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", pids);
        const pm = new Map(profiles?.map((p) => [p.id, p.username]) ?? []);
        reportData.forEach((r) => {
          r.reporterName = pm.get(r.reporter_id) ?? r.reporter_id.slice(0, 8);
          r.reportedName = r.reported_user_id ? (pm.get(r.reported_user_id) ?? r.reported_user_id.slice(0, 8)) : "—";
        });
      }

      setReports(reportData);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() =>
    statusFilter === "all" ? reports : reports.filter((r) => r.status === statusFilter),
    [reports, statusFilter]
  );

  const counts = useMemo(() => ({
    new: reports.filter((r) => r.status === "new").length,
    reviewed: reports.filter((r) => r.status === "reviewed").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
  }), [reports]);

  async function updateStatus(id: string, newStatus: ReportStatus) {
    setSaving(id);
    const supabase = createClient();
    if (!supabase) { setSaving(null); return; }

    const update: Partial<Report> = {
      status: newStatus,
      admin_notes: notes[id] || undefined,
    };
    if (newStatus === "resolved") update.resolved_at = new Date().toISOString();

    const { error: err } = await supabase.from("reports").update(update).eq("id", id);
    if (!err) {
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...update } : r))
      );
    }
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "#FF5E00", borderTopColor: "transparent" }} />
      </div>
    );
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

      {/* Status tabs */}
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
            style={statusFilter === s ? { background: "#FF5E00" } : {}}
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

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-admin-card p-12 text-center">
          <p className="text-[#9CA3AF]">
            {error
              ? "Create the reports table to start tracking player reports."
              : "No reports yet."}
          </p>
          {error && (
            <pre className="mx-auto mt-4 max-w-xl rounded-lg bg-admin-bg p-4 text-left text-xs text-[#9CA3AF]">
{`-- Run in Supabase SQL editor:
CREATE TABLE reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES auth.users(id) NOT NULL,
  reported_user_id uuid REFERENCES auth.users(id),
  match_id uuid,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'new' CHECK (status IN ('new','reviewed','resolved')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admin can read/update all reports" ON reports FOR ALL USING (auth.jwt() ->> 'email' = 'aras.axmas@gmail.com');`}
            </pre>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/5 bg-admin-card">
              <button
                type="button"
                className="flex w-full items-start gap-4 p-5 text-left"
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                    <span className="text-sm font-medium text-white">{r.reason}</span>
                    <span className="text-sm text-[#9CA3AF]">
                      by <span className="text-white">{r.reporterName}</span>
                      {r.reportedName !== "—" && (
                        <> → <span className="text-white">{r.reportedName}</span></>
                      )}
                    </span>
                  </div>
                  {r.description && (
                    <p className="mt-1 text-sm text-[#9CA3AF] line-clamp-2">{r.description}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-[#6B7280]">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  {r.match_id && (
                    <p className="mt-0.5 font-mono text-[10px] text-[#6B7280]">
                      match: {r.match_id.slice(0, 8)}
                    </p>
                  )}
                </div>
              </button>

              {expandedId === r.id && (
                <div className="border-t border-white/5 px-5 pb-5 pt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-[#6B7280]">Full Description</p>
                      <p className="mt-1 text-sm text-white">
                        {r.description || "No description provided."}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#6B7280]">Report ID</p>
                      <p className="mt-1 font-mono text-xs text-white">{r.id}</p>
                      {r.resolved_at && (
                        <>
                          <p className="mt-2 text-xs text-[#6B7280]">Resolved At</p>
                          <p className="mt-0.5 text-xs text-white">
                            {new Date(r.resolved_at).toLocaleString()}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#6B7280]">Admin Notes</label>
                    <textarea
                      rows={2}
                      value={notes[r.id] ?? r.admin_notes ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-[#6B7280] focus:border-[#FF5E00] focus:outline-none resize-none"
                      placeholder="Add admin notes…"
                    />
                  </div>

                  <div className="flex gap-2">
                    {r.status === "new" && (
                      <button
                        type="button"
                        disabled={saving === r.id}
                        onClick={() => updateStatus(r.id, "reviewed")}
                        className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50"
                      >
                        Mark Reviewed
                      </button>
                    )}
                    {r.status !== "resolved" && (
                      <button
                        type="button"
                        disabled={saving === r.id}
                        onClick={() => updateStatus(r.id, "resolved")}
                        className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                      >
                        {saving === r.id ? "Saving…" : "Resolve"}
                      </button>
                    )}
                    {r.status === "resolved" && r.id && (
                      <button
                        type="button"
                        disabled={saving === r.id}
                        onClick={() => updateStatus(r.id, "new")}
                        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#9CA3AF] hover:bg-white/5 disabled:opacity-50"
                      >
                        Re-open
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
