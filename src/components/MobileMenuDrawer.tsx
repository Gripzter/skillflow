"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Play", href: "/play" },
  { label: "Events", href: "/events" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Referrals", href: "/referrals" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
};

export default function MobileMenuDrawer({ open, onClose, isAuthenticated }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] md:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      <div className="absolute bottom-0 left-0 top-0 w-72 max-w-[85vw] overflow-y-auto border-r border-white/10 bg-[#0E0E12] px-5 py-6">
        <div className="mb-8 flex items-center justify-between">
          <span className="text-base font-bold text-white">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-3 text-base transition-colors ${
                  active
                    ? "bg-[#FFFF00]/10 font-bold text-[#FFFF00]"
                    : "text-white/80 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isAuthenticated ? (
          <div className="mt-8 space-y-1 border-t border-white/10 pt-6">
            <Link href="/settings" className="block px-3 py-2.5 text-sm text-white/70 hover:text-white">
              Settings
            </Link>
            <a
              href="mailto:admin@skillflow.gg"
              className="block px-3 py-2.5 text-sm text-white/70 hover:text-white"
            >
              Contact support
            </a>
          </div>
        ) : (
          <div className="mt-8 space-y-2 border-t border-white/10 pt-6">
            <Link
              href="/login"
              className="block rounded-lg border border-white/20 px-3 py-2.5 text-center text-sm font-semibold text-white"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="block rounded-lg bg-[#FFFF00] px-3 py-2.5 text-center text-sm font-bold text-black"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
