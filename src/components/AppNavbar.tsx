"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getWalletBalance, getMyProfile } from "@/lib/api";
import ConnectionBadge from "@/components/ConnectionBadge";
import { usePlayMode } from "@/contexts/PlayModeContext";

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
  currentPage: "dashboard" | "wallet" | "play" | "leaderboard" | "profile" | "external" | "settings" | "referrals";
}

export default function AppNavbar({
  username,
  isDevMode,
  onLogout,
  loggingOut,
  currentPage,
}: AppNavbarProps) {
  const { isPractice } = usePlayMode();
  const [balance, setBalance] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    async function loadAvatar() {
      const profile = await getMyProfile();
      if (!cancelled && profile && "avatar_url" in profile) {
        const url = (profile as any).avatar_url as string | null;
        if (url) setAvatarUrl(url);
      }
    }
    loadAvatar();
    return () => {
      cancelled = true;
    };
  }, []);

  const balanceFormatted = balance.toFixed(2);

  return (
    <header className="navbar sticky top-0 z-50 border-b border-white/5 bg-charcoal/95 backdrop-blur-sm px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="logo shrink-0 text-xl font-bold tracking-tight">
            <span className="text-white">Skill</span>
            <span className={isPractice ? "text-purple-500" : "text-teal"}>Flow</span>
          </Link>
          {isPractice && (
            <span className="hidden rounded-full border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-400 sm:inline-flex">
              PRACTICE
            </span>
          )}
          <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href="/dashboard"
            className={`nav-link rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === "dashboard"
                ? "active bg-white/10 text-white"
                : "text-body-gray hover:text-white"
            }`}
          >
            Dashboard
          </Link>
          {!isPractice && (
            <Link
              href="/wallet"
              className={`nav-link rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                currentPage === "wallet"
                  ? "active bg-white/10 text-white"
                  : "text-body-gray hover:text-white"
              }`}
            >
              Wallet
            </Link>
          )}
          <Link
            href="/play"
            className={`nav-link rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === "play"
                ? "active bg-white/10 text-white"
                : "text-body-gray hover:text-white"
            }`}
          >
            Play
          </Link>
          {/* Arena + Last Touch removed — not yet built */}
          <Link
            href="/leaderboard"
            className={`nav-link rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === "leaderboard"
                ? "active bg-white/10 text-white"
                : "text-body-gray hover:text-white"
            }`}
          >
            Leaderboard
          </Link>
          <Link
            href="/referrals"
            className={`nav-link rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === "referrals"
                ? "active bg-white/10 text-white"
                : "text-body-gray hover:text-white"
            }`}
          >
            Referrals
          </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <ConnectionBadge />
          {!isPractice && (
            <div className="wallet-badge flex items-center gap-1.5 rounded-lg border border-white/15 bg-card/60 px-3 py-2 shadow-[0_0_16px_rgba(16,185,129,0.35)]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
              <span className="text-sm font-bold text-white">
                ${balanceFormatted}
              </span>
            </div>
          )}

          <Link
            href="/profile"
            className="hidden items-center gap-2 rounded-lg px-2 py-1.5 text-body-gray transition-colors hover:bg-white/5 hover:text-white sm:flex"
          >
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-6 w-6 rounded-full object-cover"
              />
            )}
            <span className="text-sm font-medium">{username}</span>
            {isDevMode && (
              <span className="rounded bg-purple/20 px-1.5 py-0.5 text-xs font-medium text-purple">
                DEV
              </span>
            )}
          </Link>

          <Link
            href="/settings"
            className="settings-link flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-body-gray transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Settings"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          <Link
            href="/profile"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ring-2 ring-white/10 transition-opacity hover:opacity-90 ${
              isPractice ? "from-purple-500/40 to-fuchsia-500/40" : "from-teal/40 to-purple/40"
            }`}
            aria-label="Profile"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-white">
                {username.charAt(0).toUpperCase()}
              </span>
            )}
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
