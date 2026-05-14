"use client";

import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import { usePlayMode } from "@/contexts/PlayModeContext";
import { Gamepad2, Gift, House, Trophy, Wallet } from "lucide-react";
import { IS_SWEEPSTAKES_LAUNCH } from "@/constants/economy";

const TABS: readonly {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}[] = [
  { href: "/dashboard", label: "Home", Icon: House },
  { href: "/play", label: "Play", Icon: Gamepad2 },
  { href: "/wallet", label: "Wallet", Icon: Wallet },
  { href: "/leaderboard", label: "Rank", Icon: Trophy },
  { href: "/cases", label: "Cases", Icon: Gift },
];

export default function MobileTabBar() {
  const pathname = usePathname();
  const { isPractice } = usePlayMode();

  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/match")
  ) {
    return null;
  }

  const tabs = (isPractice ? TABS.filter((t) => t.href !== "/wallet") : TABS).map((tab) => {
    if (tab.href === "/wallet" && IS_SWEEPSTAKES_LAUNCH) {
      return { ...tab, href: "/skillpoints", label: "SP" };
    }
    return tab;
  });
  const goTo = (href: string) => {
    if (typeof window !== "undefined") {
      window.location.href = href;
    }
  };

  return (
    <nav
      className="mobile-tab-bar fixed bottom-0 left-0 right-0 z-40 hidden h-[60px] items-stretch border-t pb-[env(safe-area-inset-bottom)] max-lg:flex lg:hidden"
      aria-label="Primary"
      style={{ background: "#0E0E12", borderColor: "#1a1a2e" }}
    >
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href ||
          pathname.startsWith(tab.href + "/");
        const color = isActive ? "text-[#FFFF00]" : "text-[#888]";
        return (
          <button
            type="button"
            key={tab.href}
            onClick={() => goTo(tab.href)}
            className={`pressable relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${color}`}
          >
            <tab.Icon size={22} className="shrink-0" />
            <span className="relative text-[10px] font-medium leading-none">
              {tab.label}
              {tab.href === "/play" && isPractice && (
                <span className="absolute -right-3 top-0 h-2 w-2 rounded-full bg-purple-500" aria-hidden />
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

