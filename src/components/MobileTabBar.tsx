"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlayMode } from "@/contexts/PlayModeContext";
import { House, Gamepad2, Wallet, Trophy, User } from "lucide-react";

const TABS: readonly {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}[] = [
  { href: "/dashboard", label: "Home", Icon: House },
  { href: "/play", label: "Play", Icon: Gamepad2 },
  { href: "/wallet", label: "Wallet", Icon: Wallet },
  { href: "/leaderboard", label: "Rank", Icon: Trophy },
  { href: "/profile", label: "Profile", Icon: User },
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

  const tabs = isPractice ? TABS.filter((t) => t.href !== "/wallet") : TABS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 hidden h-[60px] items-stretch border-t pb-[env(safe-area-inset-bottom)] max-lg:flex"
      aria-label="Primary"
      style={{ background: "#0E0E12", borderColor: "#1a1a2e" }}
    >
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href ||
          pathname.startsWith(tab.href + "/");
        const color = isActive ? "text-[#FF5E00]" : "text-[#888]";
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pressable relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${color}`}
          >
            <tab.Icon size={22} className="shrink-0" />
            <span className="relative text-[10px] font-medium leading-none">
              {tab.label}
              {tab.href === "/play" && isPractice && (
                <span className="absolute -right-3 top-0 h-2 w-2 rounded-full bg-purple-500" aria-hidden />
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

