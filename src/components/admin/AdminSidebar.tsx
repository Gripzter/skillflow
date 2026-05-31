"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLogout } from "@/lib/admin-auth";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Overview",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.8" />
        <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.8" />
        <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.8" />
        <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.8" />
      </svg>
    ),
  },
  {
    href: "/admin/revenue",
    label: "Revenue",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1v14M5 4l3-3 3 3M5 12l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1 8h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1 14c0-3 2-5 5-5s5 2 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 7c1.5 0 3 1 3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <circle cx="12" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      </svg>
    ),
  },
  {
    href: "/admin/matches",
    label: "Matches",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L9.5 6H14L10.5 8.5L12 12.5L8 10L4 12.5L5.5 8.5L2 6H6.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/tax",
    label: "Tax Report",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    await adminLogout();
    window.location.href = "/admin/login";
  }

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-56 flex-col border-r border-white/5 bg-[#080A0E]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-white/5 px-5 py-[18px]">
        <span className="text-base font-bold tracking-tight text-white">SkillFlow</span>
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-black"
          style={{ background: "#FFFF00" }}
        >
          ADMIN
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive =
            href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/5 text-white"
                  : "text-[#9CA3AF] hover:bg-white/[0.03] hover:text-white"
              }`}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full"
                  style={{ background: "#FFFF00" }}
                />
              )}
              <span
                className={isActive ? "text-[#FFFF00]" : "text-current"}
                aria-hidden
              >
                {icon}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 p-3 space-y-0.5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded px-3 py-2 text-sm text-[#9CA3AF] transition-colors hover:bg-white/5 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M6 3L2 7l4 4M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Site
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[#9CA3AF] transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3M9 10l3-3-3-3M13 7H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
