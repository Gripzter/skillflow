"use client";

import { useEffect, useState, useCallback } from "react";
import LoadingRing from "@/components/LoadingRing";

type ErrorReport = {
  id: string;
  user_id: string | null;
  username: string | null;
  error_message: string | null;
  error_stack: string | null;
  page_url: string | null;
  user_description: string | null;
  device_info: string | null;
  created_at: string;
  resolved: boolean;
};

export default function AdminErrorsPage() {
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/error-reports");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const markResolved = async (id: string, resolved: boolean) => {
    try {
      const res = await fetch(`/api/admin/error-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      if (!res.ok) return;
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, resolved } : r))
      );
    } catch {
      // ignore
    }
  };

  const unresolvedCount = reports.filter((r) => !r.resolved).length;

  if (loading) {
    return <LoadingRing />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Error Reports</h1>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-red-500/20 px-3 py-1 text-sm font-medium text-red-400">
            {unresolvedCount} unresolved
          </span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchReports();
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-admin-body hover:bg-white/10 hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {reports.length === 0 ? (
          <p className="text-admin-body">No error reports yet.</p>
        ) : (
          reports.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-4 ${
                r.resolved
                  ? "border-white/5 bg-white/[0.02]"
                  : "border-red-500/20 bg-red-500/5"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm text-red-300">
                    {r.error_message ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-admin-body">
                    {new Date(r.created_at).toLocaleString()} • {r.username ?? "anonymous"}
                    {r.page_url ? ` • ${r.page_url}` : ""}
                  </p>
                  {r.user_description && (
                    <p className="mt-2 text-sm text-white">
                      &quot;{r.user_description}&quot;
                    </p>
                  )}
                  {r.device_info && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-admin-body">
                        Device info
                      </summary>
                      <pre className="mt-1 max-h-24 overflow-auto rounded bg-black/30 p-2 text-xs text-admin-body">
                        {r.device_info}
                      </pre>
                    </details>
                  )}
                  {r.error_stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-admin-body">
                        Stack
                      </summary>
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-black/30 p-2 text-xs text-admin-body">
                        {r.error_stack}
                      </pre>
                    </details>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => markResolved(r.id, !r.resolved)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    r.resolved
                      ? "border border-white/10 bg-white/5 text-admin-body hover:bg-white/10"
                      : "border border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  }`}
                >
                  {r.resolved ? "Mark unresolved" : "Mark resolved"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
