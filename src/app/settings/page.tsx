"use client";

import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<{ user_metadata?: { username?: string } } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (typeof window !== "undefined" && localStorage.getItem("skillflow_dev_mode") === "true") {
        try {
          const raw = localStorage.getItem("skillflow_dev_user");
          if (raw) {
            const dev = JSON.parse(raw) as { username: string };
            setUser({ user_metadata: { username: dev.username } });
            setLoading(false);
            return;
          }
        } catch {
          // fall through
        }
      }
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        router.push("/login");
        return;
      }
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <svg className="h-10 w-10 animate-spin text-teal" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  const username = user?.user_metadata?.username ?? "Player";
  const isDevMode = typeof window !== "undefined" && localStorage.getItem("skillflow_dev_mode") === "true";

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={!!isDevMode}
        onLogout={() => {}}
        loggingOut={false}
        currentPage="settings"
      />
      <main className="settings-page-default mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>

        {/* Theme */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-white">App Theme</h2>
          <p className="mt-1 text-sm text-body-gray">Customize the look and feel of SkillFlow</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTheme("default")}
              className={`group relative flex flex-col rounded-xl border-2 p-5 text-left transition-all ${
                theme === "default"
                  ? "border-teal bg-teal/5 shadow-[0_0_20px_rgba(0,229,199,0.15)]"
                  : "border-white/10 bg-card hover:border-white/20"
              }`}
            >
              {theme === "default" && (
                <span className="absolute right-3 top-3 text-teal" aria-hidden>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
              <div className="mb-4 h-16 w-full overflow-hidden rounded-lg bg-[#0D0F14] p-2">
                <div className="flex gap-1">
                  <div className="h-2 flex-1 rounded bg-white/10" />
                  <div className="h-2 w-8 rounded bg-teal/60" />
                  <div className="h-2 w-6 rounded bg-purple/50" />
                </div>
                <div className="mt-2 flex gap-2">
                  <div className="h-6 flex-1 rounded bg-white/5" />
                  <div className="h-6 w-12 rounded border border-teal/30 bg-teal/10" />
                </div>
              </div>
              <span className="font-semibold text-white">Default</span>
              <span className="mt-0.5 text-sm text-body-gray">Clean and modern</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme("sci-fi")}
              className={`group relative flex flex-col rounded-xl border-2 p-5 text-left transition-all ${
                theme === "sci-fi"
                  ? "border-[#00F0FF] bg-[#00F0FF]/5 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                  : "border-white/10 bg-card hover:border-white/20"
              }`}
            >
              <span className="absolute right-3 top-3 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                NEW ✨
              </span>
              {theme === "sci-fi" && (
                <span className="absolute right-3 top-10 text-[#00F0FF]" aria-hidden>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
              <div className="mb-4 h-16 w-full overflow-hidden rounded-lg bg-[#050510] p-2">
                <div className="flex gap-1">
                  <div className="h-2 flex-1 rounded bg-white/10" />
                  <div className="h-2 w-8 rounded bg-[#00F0FF]/60 shadow-[0_0_6px_rgba(0,240,255,0.5)]" />
                  <div className="h-2 w-6 rounded bg-[#FF00E5]/50" />
                </div>
                <div className="mt-2 flex gap-2">
                  <div className="h-6 flex-1 rounded bg-white/5" />
                  <div className="h-6 w-12 rounded border border-[#00F0FF]/30 bg-[#00F0FF]/10" />
                </div>
              </div>
              <span className="font-semibold text-white">Sci-Fi</span>
              <span className="mt-0.5 text-sm text-body-gray">Futuristic holographic HUD</span>
            </button>
          </div>
        </section>

        {/* Notifications (placeholder) */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
          <p className="mt-1 text-sm text-body-gray">Manage how we notify you (coming soon)</p>
          <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-card p-4">
            {[
              { label: "Match updates", on: true },
              { label: "Friend activity", on: true },
              { label: "Promotions", on: false },
              { label: "Reminders", on: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-white">{item.label}</span>
                <span className="inline-flex h-6 w-11 shrink-0 rounded-full bg-white/10 transition-colors">
                  <span className={`inline-block h-5 w-5 translate-y-0.5 translate-x-0.5 rounded-full bg-white shadow ${item.on ? "translate-x-5 bg-teal" : ""}`} />
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Account (placeholder) */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">Account</h2>
          <p className="mt-1 text-sm text-body-gray">Security and account options (coming soon)</p>
          <div className="mt-4 space-y-3">
            <button
              type="button"
              disabled
              className="w-full rounded-lg border border-white/10 bg-card px-4 py-3 text-left text-body-gray opacity-70"
            >
              Change username
            </button>
            <button
              type="button"
              disabled
              className="w-full rounded-lg border border-white/10 bg-card px-4 py-3 text-left text-body-gray opacity-70"
            >
              Change password
            </button>
            <button
              type="button"
              disabled
              className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-red-400 opacity-70"
            >
              Delete account
            </button>
          </div>
        </section>

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="inline-block rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
