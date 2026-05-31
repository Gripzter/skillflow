"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLogout } from "@/lib/admin-auth";

const NAV_LINKS: { href: string; label: string; badge?: string }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/errors", label: "Errors", badge: "errors" },
];

export default function AdminNavbar() {
  const pathname = usePathname();
  const [unresolvedCount, setUnresolvedCount] = useState<number | null>(null);

  useEffect(() => {
    if (pathname !== "/admin/errors") {
      fetch("/api/admin/error-reports")
        .then((r) => r.ok ? r.json() : [])
        .then((data: { resolved?: boolean }[]) => {
          const n = Array.isArray(data) ? data.filter((x) => !x.resolved).length : 0;
          setUnresolvedCount(n);
        })
        .catch(() => setUnresolvedCount(null));
    }
  }, [pathname]);

  async function handleLogout() {
    await adminLogout();
    window.location.href = "/admin/login";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-admin-bg">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">SkillFlow</span>
            <span className="rounded bg-admin-accent px-2 py-0.5 text-xs font-semibold text-white">
              ADMIN
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map(({ href, label, badge }) => {
              const isActive = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              const showBadge = badge === "errors" && unresolvedCount != null && unresolvedCount > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "text-white" : "text-admin-body hover:text-white"
                  }`}
                >
                  {label}
                  {showBadge && (
                    <span className="ml-1.5 rounded-full bg-red-500/80 px-1.5 py-0.5 text-xs font-semibold text-white">
                      {unresolvedCount}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-admin-accent" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-admin-body transition-colors hover:text-white"
          >
            Back to Site
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-admin-body transition-colors hover:bg-white/10 hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
