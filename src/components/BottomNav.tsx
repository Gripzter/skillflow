"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlayMode } from "@/contexts/PlayModeContext";
import { Calendar, Gamepad2, Trophy, Users } from "lucide-react";

const TABS: readonly {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}[] = [
  { href: "/play", label: "Play", Icon: Gamepad2 },
  { href: "/events", label: "Events", Icon: Calendar },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
  { href: "/referrals", label: "Referrals", Icon: Users },
];

// Routes where the persistent app bottom bar should not appear (marketing /
// auth / fullscreen flows). Mirrors the surfaces that don't render AppNavbar.
const HIDDEN_PREFIXES = ["/login", "/signup", "/admin", "/match"];

export default function BottomNav() {
  const pathname = usePathname();
  const { isPractice } = usePlayMode();

  if (pathname === "/" || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch justify-around border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
      style={{ background: "#0E0E12", borderColor: "rgba(255,255,255,0.08)" }}
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-1 transition-colors"
            style={{ color: isActive ? "#FFFF00" : "#9CA3AF" }}
          >
            <tab.Icon size={24} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
            <span className="relative text-[11px] font-medium leading-none">
              {tab.label}
              {tab.href === "/play" && isPractice && (
                <span
                  className="absolute -right-2.5 top-0 h-2 w-2 rounded-full bg-purple-500"
                  aria-hidden
                />
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
