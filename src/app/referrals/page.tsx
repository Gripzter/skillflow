"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import { useToast } from "@/components/Toast";
import { getCurrentUser } from "@/lib/api";
import { usePlayMode } from "@/contexts/PlayModeContext";
import { createClient } from "@/lib/supabase";
import { ensureReferralCode } from "@/lib/referrals";
import VelocityLoader from "@/components/VelocityLoader";

const SHARE_TEXT = "Join me on SkillFlow! Compete in skill games for real money. Use my link and we both get $5: ";
const MAX_REFERRAL_BONUSES = 50;

interface ReferralRow {
  id: string;
  referred_username: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export default function ReferralsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isPractice } = usePlayMode();
  const [username, setUsername] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [stats, setStats] = useState({
    totalReferrals: 0,
    completed: 0,
    totalEarned: 0,
    pending: 0,
  });
  const [history, setHistory] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }
      setUsername(user.username);
      const code = await ensureReferralCode(supabase, user.id, user.username);
      setReferralCode(code);

      const { data: profile } = await supabase
        .from("profiles")
        .select("total_referrals, referral_earnings")
        .eq("id", user.id)
        .single();

      const totalReferrals = Number(profile?.total_referrals ?? 0);
      const totalEarned = Number(profile?.referral_earnings ?? 0);

      const { data: refs } = await supabase
        .from("referrals")
        .select("id, referred_id, status, created_at, completed_at")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      const completed = refs?.filter((r) => r.status === "completed").length ?? 0;
      const pending = (refs?.length ?? 0) - completed;

      const referredIds = (refs ?? []).map((r) => (r as { referred_id?: string }).referred_id).filter(Boolean);
      let referredUsernames: Record<string, string> = {};
      if (referredIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", referredIds as string[]);
        referredUsernames = Object.fromEntries(
          (profiles ?? []).map((p) => [p.id, p.username ?? "Player"])
        );
      }

      const refsWithUsername = (refs ?? []).map((r) => {
        const row = r as { id: string; referred_id?: string; status: string; created_at: string; completed_at: string | null };
        return {
          id: row.id,
          referred_username: referredUsernames[row.referred_id ?? ""] ?? "Player",
          status: row.status,
          created_at: row.created_at,
          completed_at: row.completed_at,
        };
      });

      setStats({
        totalReferrals: refs?.length ?? 0,
        completed,
        totalEarned,
        pending,
      });
      setHistory(refsWithUsername);
      setLoading(false);
    }
    load();
  }, [router]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/invite/${referralCode}` : "";
  const shareMessage = SHARE_TEXT + shareUrl;

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showToast("Link copied!", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank");
  }

  function shareTwitter() {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`, "_blank");
  }

  function shareTelegram() {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent("Join me on SkillFlow — we both get $5!")}`, "_blank");
  }

  if (loading) {
    return <VelocityLoader />;
  }

  const isMaxed = stats.completed >= MAX_REFERRAL_BONUSES;

  return (
    <div className="min-h-screen bg-charcoal pb-24 md:pb-0">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={false}
        onLogout={() => {}}
        loggingOut={false}
        currentPage="referrals"
      />
      <main className="relative mx-auto max-w-[600px] px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-white">Invite Friends, Earn $5 Each</h1>
        <p className="mt-1 text-body-gray">Share your link. When they sign up and make their first deposit ($5+), you both get $5.</p>

        <section className="mt-6 rounded-xl border border-white/10 bg-card p-6">
          <p className="text-sm text-body-gray">Share your link:</p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 rounded-lg border border-white/10 bg-[#1A1D27] px-3 py-2.5 text-sm text-white"
            />
            <button
              type="button"
              onClick={copyLink}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-charcoal transition-all ${
                isPractice
                  ? "bg-purple-500 text-white hover:shadow-[0_0_18px_rgba(139,92,246,0.45)]"
                  : "bg-teal hover:shadow-teal-glow"
              }`}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 text-sm text-body-gray">
            Or share your code: <span className="font-mono font-medium text-white">{referralCode}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={shareWhatsApp}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={shareTwitter}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
            >
              X / Twitter
            </button>
            <button
              type="button"
              onClick={shareTelegram}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400"
            >
              Telegram
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
            >
              Copy Link
            </button>
          </div>
        </section>

        <div className="mt-6 rounded-xl border border-white/10 bg-card/50 p-4 text-sm text-body-gray">
          <p className="font-medium text-white">How it works</p>
          <ol className="mt-2 list-decimal list-inside space-y-1">
            <li>Share your unique link with friends</li>
            <li>They sign up using your link</li>
            <li>When they make their first deposit ($5+), you both get $5 bonus</li>
            <li>Invite as many friends as you want!</li>
          </ol>
        </div>

        <section className="mt-8 rounded-xl border border-white/10 bg-card p-6">
          <h2 className="text-lg font-semibold text-white">Your Referral Stats</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-body-gray">Friends Invited</p>
              <p className="text-xl font-bold text-white">{stats.totalReferrals}</p>
            </div>
            <div>
              <p className="text-xs text-body-gray">Successful</p>
              <p className={`text-xl font-bold ${isPractice ? "text-purple-300" : "text-teal"}`}>{stats.completed}</p>
            </div>
            <div>
              <p className="text-xs text-body-gray">Total Earned</p>
              <p className="text-xl font-bold text-white">${stats.totalEarned.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-body-gray">Pending</p>
              <p className="text-xl font-bold text-amber-400">{stats.pending} waiting</p>
            </div>
          </div>
          {isMaxed && (
            <p className="mt-3 text-sm text-amber-300">
              You&apos;ve maxed out referral bonuses! Thanks for spreading the word.
            </p>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-white/10 bg-card p-6">
          <h2 className="text-lg font-semibold text-white">Referral History</h2>
          {history.length === 0 ? (
            <p className="mt-4 text-body-gray">No referrals yet. Share your link to get started!</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {history.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <span className="font-medium text-white">{row.referred_username}</span>
                    <span className="ml-2 text-sm text-body-gray">
                      {row.status === "completed" ? "Completed" : "Pending deposit"}
                    </span>
                  </div>
                  {row.status === "completed" && (
                    <span className={`text-sm font-medium ${isPractice ? "text-purple-300" : "text-teal"}`}>+$5</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-block rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
