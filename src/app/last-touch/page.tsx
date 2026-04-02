"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import AppNavbar, { dispatchWalletUpdated } from "@/components/AppNavbar";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import { getCurrentUser, getWalletBalance, debitWallet, creditWallet } from "@/lib/api";
import LastTouch from "@/components/games/LastTouch";
import { createClient } from "@/lib/supabase";
import {
  ensureUpcomingSessions,
  fetchActiveSession,
  type LastTouchSession,
} from "@/lib/games/last-touch-sessions";

function LastTouchPageContent() {
  const router = useRouter();
  const [username, setUsername] = useState("Player");
  const [userId, setUserId] = useState("");
  const [isDevMode, setIsDevMode] = useState(false);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [session, setSession] = useState<LastTouchSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const refundedSessionsRef = useRef<Set<string>>(new Set());

  // Load user
  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);
        setUsername(user.username);
        setIsDevMode(user.isDevMode ?? false);
        const bal = await getWalletBalance();
        setBalance(bal);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // Ensure upcoming sessions exist, then load the active one
  useEffect(() => {
    async function loadSession() {
      const supabase = createClient();
      if (!supabase) { setSessionLoading(false); return; }
      await ensureUpcomingSessions(supabase);
      const s = await fetchActiveSession(supabase);
      setSession(s);
      setSessionLoading(false);
    }
    loadSession();
  }, []);

  // Subscribe to session INSERTs — so test sessions or newly created ones appear immediately
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const ch = supabase
      .channel("lt-sessions-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "last_touch_sessions" },
        async () => {
          const s = await fetchActiveSession(supabase);
          setSession((prev) => {
            // Switch to the new session only if it starts sooner than the current one
            if (!prev) return s;
            if (!s) return prev;
            return new Date(s.scheduled_start_at) < new Date(prev.scheduled_start_at) ? s : prev;
          });
        }
      )
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const handleJoinRequest = useCallback(async (fee: number): Promise<boolean> => {
    setJoinError(null);
    try {
      await debitWallet(fee, "Last Touch entry");
      dispatchWalletUpdated();
      setBalance((b) => b - fee);
      return true;
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Insufficient balance");
      return false;
    }
  }, []);

  const handleWin = useCallback(async (amount: number) => {
    try {
      await creditWallet(amount, "Last Touch – You won!", "match_win");
      dispatchWalletUpdated();
    } catch {
      dispatchWalletUpdated();
    }
  }, []);

  const handleEliminated = useCallback((_rank: number, _total: number) => {}, []);

  const handleSessionUpdate = useCallback((updated: LastTouchSession) => {
    setSession(updated);
  }, []);

  const handleSessionCancelled = useCallback(async (sessionId: string, amount: number) => {
    if (refundedSessionsRef.current.has(sessionId)) return;
    refundedSessionsRef.current.add(sessionId);
    try {
      await creditWallet(amount, "Last Touch cancelled – entry refunded", "match_refund");
      dispatchWalletUpdated();
      setBalance((b) => b + amount);
    } catch {
      dispatchWalletUpdated();
    }
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { logout } = await import("@/lib/api");
      await logout();
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0a0f]">
      {/* Aurora background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 229, 199, 0.15), transparent),
            radial-gradient(ellipse 60% 40% at 80% 50%, rgba(124, 92, 252, 0.12), transparent),
            radial-gradient(ellipse 50% 30% at 20% 80%, rgba(0, 229, 199, 0.08), transparent)
          `,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 animate-pulse opacity-30"
        style={{ animationDuration: "8s" }}
        aria-hidden
      >
        <div className="absolute left-1/4 top-1/3 h-96 w-96 rounded-full bg-teal/20 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-purple-500/20 blur-[80px]" />
      </div>

      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="play"
      />
      <ModeToggleBarContent />

      <main className="relative mx-auto max-w-lg px-4 pt-6 pb-24 sm:px-6 md:pt-8">
        {joinError && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {joinError}
          </div>
        )}

        {sessionLoading ? (
          <div className="flex justify-center py-16">
            <svg className="h-8 w-8 animate-spin text-teal" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        ) : (
          <LastTouch
            session={session}
            userId={userId}
            username={username}
            onJoinRequest={handleJoinRequest}
            onWin={handleWin}
            onEliminated={handleEliminated}
            onSessionUpdate={handleSessionUpdate}
            onSessionCancelled={handleSessionCancelled}
          />
        )}
      </main>
    </div>
  );
}

export default function LastTouchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-charcoal text-white">
          Loading…
        </div>
      }
    >
      <LastTouchPageContent />
    </Suspense>
  );
}
