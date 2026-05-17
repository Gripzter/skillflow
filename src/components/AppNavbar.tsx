"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectionBadge from "@/components/ConnectionBadge";
import MobileMenuDrawer from "@/components/MobileMenuDrawer";
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
    | "events"
    | "skillpoints"
    | "cases"
    | "inventory";
  initialOpenSpModal?: boolean;
}

const NAV_ITEMS = [
  { label: "Play", href: "/play" },
  { label: "Events", href: "/events" },
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
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0E0E12]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-white/5 hover:text-white md:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <Wordmark href="/play" size="sm" />
          </div>

          <nav className="hidden items-center gap-6 lg:gap-8 md:flex">
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

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSpModalOpen(true)}
              className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-white/10 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm"
              aria-label={`SkillPoints: ${profile.lifetimeSp.toLocaleString()}`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold sm:h-5 sm:w-5 sm:text-[10px]">
                SP
              </span>
              <span className="hidden text-white/60 sm:inline">{formatTier(profile.rankTier)} ·</span>
              <span>{profile.lifetimeSp.toLocaleString()}</span>
            </button>

            <button
              type="button"
              onClick={() => setSkilliesModalOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-[#FFFF00] transition-colors hover:bg-white/10 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm"
              aria-label={`Skillies: ${profile.balanceSp.toLocaleString()}`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-black sm:h-5 sm:w-5 sm:text-[10px]">
                S
              </span>
              <span>{profile.balanceSp.toLocaleString()}</span>
            </button>

            <div className="hidden sm:flex">
              <ConnectionBadge />
            </div>

            <Link
              href="/settings"
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-white/5 hover:text-white sm:flex"
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
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 sm:h-9 sm:w-9"
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
      </header>
      <MobileMenuDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

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
