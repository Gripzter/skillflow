"use client";

import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
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

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={!!(typeof window !== "undefined" && localStorage.getItem("skillflow_dev_mode") === "true")}
        onLogout={() => {}}
        loggingOut={false}
        currentPage="profile"
      />
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="card-border rounded-card bg-card p-8 text-center">
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="mt-2 text-body-gray">Edit profile and preferences — coming soon.</p>
          <Link href="/profile" className="mt-4 inline-block rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            Back to profile
          </Link>
        </div>
      </main>
    </div>
  );
}
