"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlayMode } from "@/contexts/PlayModeContext";

const TABS = [
  { href: "/dashboard", icon: "🏠", label: "Home" },
  { href: "/play", icon: "🎮", label: "Play" },
  { href: "/wallet", icon: "💰", label: "Wallet" },
  { href: "/leaderboard", icon: "🏆", label: "Rank" },
  { href: "/profile", icon: "👤", label: "Profile" },
] as const;

export default function MobileTabBar() {
  const pathname = usePathname();
  const { isPractice } = usePlayMode();

  // Hide on unauth / marketing / admin routes
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/admin")
  ) {
    return null;
  }

  const tabs = isPractice ? TABS.filter((t) => t.href !== "/wallet") : TABS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-[60px] items-stretch border-t border-white/10 bg-charcoal/95 pb-[env(safe-area-inset-bottom)] text-xs text-body-gray backdrop-blur-2xl md:hidden"
      aria-label="Primary"
    >
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href ||
          pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pressable relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive ? "text-teal" : "text-body-gray"
            }`}
          >
            <span className="relative inline-block text-lg" aria-hidden>
              {tab.icon}
              {tab.href === "/play" && isPractice && (
                <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-purple-500" aria-hidden />
              )}
            </span>
            <span className="text-[11px] font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

