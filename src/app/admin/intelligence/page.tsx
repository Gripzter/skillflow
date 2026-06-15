"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPageHeader,
  AdminTableShell,
  RiskBadge,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";
import { truncateId } from "@/lib/admin-api";

type IntelligenceData = {
  suspiciousPlayers: Array<{
    playerId: string;
    username: string;
    banned: boolean;
    suspicious: boolean;
    flagCount: number;
    risk: "low" | "medium" | "high";
    reasons: string[];
  }>;
  ipCollisions: Array<{
    ip: string;
    userIds: string[];
    count: number;
  }>;
  winStreaks: Array<{
    playerId: string;
    game: string;
    streak: number;
    startedAt: string;
  }>;
  botMatches: Array<{
    match_id: string;
    reaction_time_ms: number;
    event_type: string;
    created_at: string;
  }>;
  anomalies: {
    revenueDrop: boolean;
    revenueTodaySK: number;
    revenueAvg7SK: number;
  };
};

export default function AdminIntelligencePage() {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<IntelligenceData>("/api/admin/intelligence");
      setData(res);
    } catch (err) {
      console.error("[admin intelligence]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader title="intelligence" subtitle="fraud detection and anomaly signals" />

      {data?.anomalies.revenueDrop ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          revenue anomaly detected — today ({data.anomalies.revenueTodaySK.toLocaleString()} sk) is
          below 70% of 7-day average ({data.anomalies.revenueAvg7SK.toLocaleString()} sk)
        </div>
      ) : null}

      <Section title="suspicious players">
        <AdminTableShell>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">player</th>
                <th className="px-4 py-3">flags</th>
                <th className="px-4 py-3">risk</th>
                <th className="px-4 py-3">reasons</th>
                <th className="px-4 py-3">status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.suspiciousPlayers ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[#7A7A8E]">
                    no flagged players
                  </td>
                </tr>
              ) : (
                data!.suspiciousPlayers.map((p, i) => (
                  <tr
                    key={p.playerId}
                    className={`cursor-pointer ${i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"} hover:bg-white/5`}
                    onClick={() => {
                      window.location.href = `/admin/players/${p.playerId}`;
                    }}
                  >
                    <td className="px-4 py-3 text-white">{p.username}</td>
                    <td className="px-4 py-3 text-[#FFFF00]">{p.flagCount}</td>
                    <td className="px-4 py-3">
                      <RiskBadge level={p.risk} />
                    </td>
                    <td className="px-4 py-3 text-[#C8C8D4]">{p.reasons.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-xs lowercase text-[#7A7A8E]">
                      {p.banned ? "banned" : p.suspicious ? "suspicious" : "flagged"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </Section>

      <Section title="ip collisions">
        <AdminTableShell>
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">ip address</th>
                <th className="px-4 py-3">accounts</th>
                <th className="px-4 py-3">user ids</th>
              </tr>
            </thead>
            <tbody>
              {(data?.ipCollisions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[#7A7A8E]">
                    no ip collisions detected
                  </td>
                </tr>
              ) : (
                data!.ipCollisions.map((c, i) => (
                  <tr key={c.ip} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                    <td className="px-4 py-3 font-mono text-xs text-white">{c.ip}</td>
                    <td className="px-4 py-3 text-orange-400">{c.count}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#C8C8D4]">
                      {c.userIds.map((id) => truncateId(id)).join(", ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </Section>

      <Section title="win streaks (5+)">
        <AdminTableShell>
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">player</th>
                <th className="px-4 py-3">game</th>
                <th className="px-4 py-3">streak</th>
                <th className="px-4 py-3">started</th>
              </tr>
            </thead>
            <tbody>
              {(data?.winStreaks ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[#7A7A8E]">
                    no notable win streaks
                  </td>
                </tr>
              ) : (
                data!.winStreaks.map((s, i) => (
                  <tr
                    key={`${s.playerId}-${s.game}`}
                    className={`cursor-pointer ${i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"} hover:bg-white/5`}
                    onClick={() => {
                      window.location.href = `/admin/players/${s.playerId}`;
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{truncateId(s.playerId)}</td>
                    <td className="px-4 py-3 text-[#C8C8D4]">{s.game}</td>
                    <td className="px-4 py-3 font-semibold text-[#FFFF00]">{s.streak}</td>
                    <td className="px-4 py-3 text-xs text-[#7A7A8E]">
                      {new Date(s.startedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </Section>

      <Section title="bot matches (fast reactions)">
        <AdminTableShell>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">match</th>
                <th className="px-4 py-3">event</th>
                <th className="px-4 py-3">reaction ms</th>
                <th className="px-4 py-3">detected</th>
              </tr>
            </thead>
            <tbody>
              {(data?.botMatches ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[#7A7A8E]">
                    no bot-like events detected
                  </td>
                </tr>
              ) : (
                data!.botMatches.map((b, i) => (
                  <tr
                    key={`${b.match_id}-${b.created_at}`}
                    className={`cursor-pointer ${i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"} hover:bg-white/5`}
                    onClick={() => {
                      window.location.href = `/admin/matches/${b.match_id}`;
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#FFFF00]">
                      {truncateId(b.match_id)}
                    </td>
                    <td className="px-4 py-3 text-[#C8C8D4]">{b.event_type}</td>
                    <td className="px-4 py-3 text-red-400">{b.reaction_time_ms}ms</td>
                    <td className="px-4 py-3 text-xs text-[#7A7A8E]">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </Section>

      <Section title="anomalies">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
            <p className="text-xs lowercase text-[#7A7A8E]">revenue today</p>
            <p className="mt-2 text-xl text-white">
              {(data?.anomalies.revenueTodaySK ?? 0).toLocaleString()} sk
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
            <p className="text-xs lowercase text-[#7A7A8E]">7-day avg revenue</p>
            <p className="mt-2 text-xl text-white">
              {(data?.anomalies.revenueAvg7SK ?? 0).toLocaleString()} sk
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
            <p className="text-xs lowercase text-[#7A7A8E]">revenue drop alert</p>
            <p
              className={`mt-2 text-xl ${data?.anomalies.revenueDrop ? "text-red-400" : "text-emerald-400"}`}
            >
              {data?.anomalies.revenueDrop ? "active" : "none"}
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium lowercase text-[#C8C8D4]">{title}</h2>
      {children}
    </div>
  );
}
