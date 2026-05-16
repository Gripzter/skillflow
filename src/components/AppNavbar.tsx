"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectionBadge from "@/components/ConnectionBadge";
import SPIcon from "@/components/SPIcon";
import SkilliesIcon from "@/components/SkilliesIcon";
import SkillPointsModal from "@/components/modals/SkillPointsModal";
import SkilliesModal from "@/components/modals/SkilliesModal";
import Wordmark from "@/components/Wordmark";
import { useProfile } from "@/hooks/useProfile";

const WALLET_UPDATED_EVENT = "skillflow_wallet_updated";

export function dispatchWalletUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WALLET_UPDATED_EVENT));
  }
}

interface AppNavbarProps {
  username?: string;
  isDevMode?: boolean;
  onLogout?: () => void;
  loggingOut?: boolean;
  currentPage?:
    | "dashboard"
    | "wallet"
    | "play"
    | "leaderboard"
    | "profile"
    | "external"
    | "settings"
    | "referrals"
    | "skillpoints"
    | "cases"
    | "inventory";
  initialOpenSpModal?: boolean;
}

const NAV_ITEMS = [
  { label: "Play", href: "/play" },
  { label: "Cases", href: "/cases" },
  { label: "Inventory", href: "/inventory" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Referrals", href: "/referrals" },
] as const;

function formatTier(tier: string) {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}

export default function AppNavbar({ initialOpenSpModal = false }: AppNavbarProps) {
  const pathname = usePathname();
  const { profile } = useProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [spModalOpen, setSpModalOpen] = useState(false);
  const [skilliesModalOpen, setSkilliesModalOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/play" && initialOpenSpModal) {
      setSpModalOpen(true);
    }
  }, [pathname, initialOpenSpModal]);

  const avatarInitial = profile.username.charAt(0).toUpperCase() || "P";

  return (
    <>
      <header className="sticky top-0 z-50 h-14 border-b border-[#1F1F26] bg-[#0E0E12] px-3 sm:px-4">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-3">
          <div className="flex min-w-[120px] items-center">
            <Wordmark href="/play" size="sm" />
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative pb-1 text-sm font-medium transition-colors ${
                    active ? "text-white" : "text-[#9CA3AF] hover:text-white"
                  }`}
                >
                  {item.label}
                  {active ? <span className="absolute -bottom-[11px] left-0 h-0.5 w-full bg-[#FFFF00]" /> : null}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-white/5 hover:text-white md:hidden"
            aria-label="Toggle menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          <div className="flex min-w-[170px] items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSpModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-[#1F1F26] bg-[#16161C] px-2 py-1.5 text-xs text-[#9CA3AF] transition-colors hover:border-[#FFFF00]"
            >
              <SPIcon size={14} />
              <span className="hidden sm:inline">{formatTier(profile.rankTier)} · </span>
              <span>{profile.lifetimeSp.toLocaleString()}</span>
            </button>

            <button
              type="button"
              onClick={() => setSkilliesModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-[#1F1F26] bg-[#16161C] px-2 py-1.5 text-xs transition-colors hover:border-[#FFFF00]"
            >
              <SkilliesIcon size={14} />
              <span className="text-[#FFFF00]">{profile.balanceSp.toLocaleString()}</span>
            </button>

            <ConnectionBadge />

            <Link
              href="/settings"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Settings"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>

            <Link
              href="/profile"
              className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/20"
              aria-label="Profile"
            >
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">{avatarInitial}</span>
              )}
            </Link>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="absolute left-3 right-3 top-14 z-40 rounded-xl border border-[#1F1F26] bg-[#16161C] p-2 md:hidden">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    active ? "bg-white/5 text-white" : "text-[#9CA3AF]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </header>

      <SkillPointsModal
        isOpen={spModalOpen}
        onClose={() => setSpModalOpen(false)}
        userId={profile.id}
        lifetimeSp={profile.lifetimeSp}
        balanceSp={profile.balanceSp}
        rankTier={profile.rankTier}
      />
      <SkilliesModal
        isOpen={skilliesModalOpen}
        onClose={() => setSkilliesModalOpen(false)}
        userId={profile.id}
        balanceSp={profile.balanceSp}
      />
    </>
  );
}
