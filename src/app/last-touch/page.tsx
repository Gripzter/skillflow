"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppNavbar, { dispatchWalletUpdated } from "@/components/AppNavbar";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import { getCurrentUser, getWalletBalance, debitWallet, creditWallet } from "@/lib/api";
import LastTouch from "@/components/games/LastTouch";

const ENTRY_FEE = 1;

export default function LastTouchPage() {
  const router = useRouter();
  const [username, setUsername] = useState("Player");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUserId(user.id);
        setUsername(user.username);
        setUserEmail(user.email ?? "");
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

  const handleJoinRequest = useCallback(
    async (fee: number): Promise<boolean> => {
      setJoinError(null);
      try {
        await debitWallet(fee, "Last Touch entry");
        dispatchWalletUpdated();
        return true;
      } catch (e) {
        setJoinError(e instanceof Error ? e.message : "Insufficient balance");
        return false;
      }
    },
    []
  );

  const handleWin = useCallback(
    async (amount: number) => {
      try {
        await creditWallet(amount, "Last Touch – You won!", "match_win");
        dispatchWalletUpdated();
      } catch {
        dispatchWalletUpdated();
      }
    },
    []
  );

  const handleEliminated = useCallback((_rank: number, _total: number) => {
    // Optional: toast or analytics
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
      {/* Aurora-style animated background */}
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
        <p className="mb-2 text-center text-xs text-body-gray">
          Balance: ${balance.toFixed(2)} • Entry: ${ENTRY_FEE.toFixed(2)}
        </p>
        <LastTouch
          userId={userId}
          userEmail={userEmail}
          devModeRequested={searchParams.get("dev") === "true"}
          username={username}
          entryFee={ENTRY_FEE}
          onJoinRequest={handleJoinRequest}
          onWin={handleWin}
          onEliminated={handleEliminated}
        />
      </main>
    </div>
  );
}
