"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPageHeader,
  AdminTableShell,
  RelativeTime,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";

type Broadcast = {
  id: string;
  audience_type: string;
  title: string;
  body: string;
  cta_text: string | null;
  cta_url: string | null;
  channels: string[];
  delivered_count: number;
  created_at: string;
  created_by: string | null;
};

const AUDIENCE_OPTIONS = [
  { value: "all", label: "all users" },
  { value: "active_7d", label: "active last 7 days" },
  { value: "balance_gt_0", label: "balance > 0" },
  { value: "inactive_30d", label: "inactive 30+ days" },
  { value: "specific", label: "specific user (email / username / id)" },
];

export default function AdminBroadcastPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [audienceType, setAudienceType] = useState("all");
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [channelInApp, setChannelInApp] = useState(true);
  const [channelEmail, setChannelEmail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<{ broadcasts: Broadcast[] }>("/api/admin/broadcast");
      setBroadcasts(res.broadcasts);
    } catch (err) {
      console.error("[admin broadcast]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSending(true);

    const channels: string[] = [];
    if (channelInApp) channels.push("in_app");
    if (channelEmail) channels.push("email");
    if (channels.length === 0) {
      setError("select at least one channel");
      setSending(false);
      return;
    }

    try {
      const res = await adminFetch<{ success: boolean; delivered: number }>("/api/admin/broadcast", {
        method: "POST",
        body: JSON.stringify({
          audienceType,
          target: audienceType === "specific" ? target.trim() : undefined,
          title: title.trim(),
          body: body.trim(),
          ctaText: ctaText.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
          channels,
        }),
      });
      setSuccess(`sent to ${res.delivered} users`);
      setTitle("");
      setBody("");
      setCtaText("");
      setCtaUrl("");
      setTarget("");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "send failed");
    } finally {
      setSending(false);
    }
  }

  if (loading && broadcasts.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader title="broadcast" subtitle="send in-app notifications and emails" />

      <form
        onSubmit={(e) => void handleSend(e)}
        className="rounded-xl border border-white/5 bg-[#1A1A1F] p-6"
      >
        <h2 className="mb-4 text-sm font-medium lowercase text-[#C8C8D4]">compose message</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs lowercase text-[#7A7A8E]">audience</label>
            <select
              value={audienceType}
              onChange={(e) => setAudienceType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {audienceType === "specific" ? (
            <div>
              <label className="mb-1 block text-xs lowercase text-[#7A7A8E]">target</label>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="email, username, or user id"
                className="w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white placeholder:text-[#7A7A8E]"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs lowercase text-[#7A7A8E]">title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs lowercase text-[#7A7A8E]">body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs lowercase text-[#7A7A8E]">cta text (optional)</label>
            <input
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs lowercase text-[#7A7A8E]">cta url (optional)</label>
            <input
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm lowercase text-[#C8C8D4]">
            <input
              type="checkbox"
              checked={channelInApp}
              onChange={(e) => setChannelInApp(e.target.checked)}
              className="rounded border-white/20"
            />
            in-app notification
          </label>
          <label className="flex items-center gap-2 text-sm lowercase text-[#C8C8D4]">
            <input
              type="checkbox"
              checked={channelEmail}
              onChange={(e) => setChannelEmail(e.target.checked)}
              className="rounded border-white/20"
            />
            email (max 100)
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-400">{success}</p> : null}

        <button
          type="submit"
          disabled={sending}
          className="mt-4 rounded-lg bg-[#FFFF00] px-5 py-2 text-sm font-medium lowercase text-black hover:opacity-90 disabled:opacity-50"
        >
          {sending ? "sending…" : "send broadcast"}
        </button>
      </form>

      <div>
        <h2 className="mb-3 text-sm font-medium lowercase text-[#C8C8D4]">history</h2>
        <AdminTableShell>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">title</th>
                <th className="px-4 py-3">audience</th>
                <th className="px-4 py-3">channels</th>
                <th className="px-4 py-3">delivered</th>
                <th className="px-4 py-3">sent</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#7A7A8E]">
                    no broadcasts yet
                  </td>
                </tr>
              ) : (
                broadcasts.map((b, i) => (
                  <tr key={b.id} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                    <td className="px-4 py-3">
                      <p className="text-white">{b.title}</p>
                      <p className="mt-0.5 max-w-xs truncate text-xs text-[#7A7A8E]">{b.body}</p>
                    </td>
                    <td className="px-4 py-3 text-[#C8C8D4]">{b.audience_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-[#C8C8D4]">
                      {(b.channels ?? []).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#FFFF00]">{b.delivered_count}</td>
                    <td className="px-4 py-3 text-[#7A7A8E]">
                      <RelativeTime iso={b.created_at} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </div>
    </div>
  );
}
