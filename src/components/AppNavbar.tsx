"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getWalletBalance } from "@/lib/api";

const WALLET_UPDATED_EVENT = "skillflow_wallet_updated";

export function dispatchWalletUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WALLET_UPDATED_EVENT));
  }
}

interface AppNavbarProps {
  username: string;
  isDevMode: boolean;
  onLogout: () => void;
  loggingOut: boolean;
  currentPage: "dashboard" | "wallet" | "play" | "leaderboard" | "profile" | "external";
}

export default function AppNavbar({
  username,
  isDevMode,
  onLogout,
  loggingOut,
  currentPage,
}: AppNavbarProps) {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const bal = await getWalletBalance();
      if (!cancelled) setBalance(bal);
    }
    load();
    const handleUpdate = () => void load();
    window.addEventListener(WALLET_UPDATED_EVENT, handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(WALLET_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  const balanceFormatted = balance.toFixed(2);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-charcoal/95 backdrop-blur-sm px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="shrink-0 text-xl font-bold tracking-tight">
            <span className="text-white">Skill</span>
            <span className="text-teal">Flow</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href="/dashboard"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === "dashboard"
                ? "bg-white/10 text-white"
                : "text-body-gray hover:text-white"
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/wallet"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === "wallet"
                ? "bg-white/10 text-white"
                : "text-body-gray hover:text-white"
            }`}
          >
            Wallet
          </Link>
          <Link
            href="/play"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === "play"
                ? "bg-white/10 text-white"
                : "text-body-gray hover:text-white"
            }`}
          >
            Play
          </Link>
          <Link
            href="/external"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === "external"
                ? "bg-white/10 text-white"
                : "text-body-gray hover:text-white"
            }`}
          >
            Arena
          </Link>
          <Link
            href="/leaderboard"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === "leaderboard"
                ? "bg-white/10 text-white"
                : "text-body-gray hover:text-white"
            }`}
          >
            Leaderboard
          </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-card/50 px-3 py-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
            <span className="text-sm font-medium text-white">${balanceFormatted}</span>
          </div>

          <Link
            href="/profile"
            className="hidden items-center gap-2 rounded-lg px-2 py-1.5 text-body-gray transition-colors hover:bg-white/5 hover:text-white sm:flex"
          >
            <span className="text-sm font-medium">{username}</span>
            {isDevMode && (
              <span className="rounded bg-purple/20 px-1.5 py-0.5 text-xs font-medium text-purple">
                DEV
              </span>
            )}
          </Link>

          <Link
            href="/profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal/40 to-purple/40 ring-2 ring-white/10 transition-opacity hover:opacity-90"
            aria-label="Profile"
          >
            <span className="text-sm font-bold text-white">
              {username.charAt(0).toUpperCase()}
            </span>
          </Link>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="rounded-lg p-2 text-body-gray transition-colors hover:bg-white/5 hover:text-white disabled:opacity-60"
            aria-label="Log out"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
