"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import ConnectionBadge from "@/components/ConnectionBadge";
import SkilliesModal from "@/components/modals/SkilliesModal";
import Wordmark from "@/components/Wordmark";
import { useProfile } from "@/hooks/useProfile";
import AvatarWithBorder from "@/components/AvatarWithBorder";

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
    | "events";
  initialOpenSpModal?: boolean;
}

const NAV_ITEMS = [
  { label: "Play", href: "/play" },
  { label: "Events", href: "/events" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Referrals", href: "/referrals" },
] as const;

export default function AppNavbar({ initialOpenSpModal = false }: AppNavbarProps) {
  const pathname = usePathname();
  const { profile, loading } = useProfile();
  const [skilliesModalOpen, setSkilliesModalOpen] = useState(false);
  const isAuthenticated = !loading && !!profile.id;

  useEffect(() => {
    void initialOpenSpModal;
  }, [pathname, initialOpenSpModal]);

  const avatarInitial = profile.username.charAt(0).toUpperCase() || "P";

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0E0E12]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-3 sm:h-16 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-8">
            <Wordmark href="/play" size="sm" />

            <nav className="hidden items-center gap-8 md:flex">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`text-sm transition-colors ${
                      active
                        ? "font-semibold text-[#FFFF00]"
                        : "font-normal text-[#9CA3AF] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            {isAuthenticated ? (
              <>
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
                  className="hidden h-10 w-10 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-white/[0.06] hover:text-white sm:flex"
                  aria-label="Settings"
                >
                  <Settings size={20} strokeWidth={1.5} aria-hidden />
                </Link>

                <Link href="/profile" className="flex flex-shrink-0 items-center" aria-label="Profile">
                  <AvatarWithBorder
                    src={profile.avatarUrl}
                    fallbackInitial={avatarInitial}
                    size="nav"
                  />
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="hidden rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:inline-flex"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-[#FFFF00] px-4 py-2 text-sm font-bold text-black transition-colors hover:brightness-110"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {isAuthenticated ? (
        <>
          <SkilliesModal
            isOpen={skilliesModalOpen}
            onClose={() => setSkilliesModalOpen(false)}
            userId={profile.id}
            balanceSp={profile.balanceSp}
          />
        </>
      ) : null}
    </>
  );
}
