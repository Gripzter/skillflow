"use client";

import { usePathname } from "next/navigation";
import { adminLogout } from "@/lib/admin-auth";

const NAV_ITEMS = [
  { href: "/admin", label: "overview", exact: true },
  { href: "/admin/matches", label: "matches" },
  { href: "/admin/qr-matches", label: "qr matches" },
  { href: "/admin/challenges", label: "challenges" },
  { href: "/admin/players", label: "players" },
  { href: "/admin/creators", label: "creators" },
  { href: "/admin/disputes", label: "disputes" },
  { href: "/admin/intelligence", label: "intelligence" },
  { href: "/admin/financials", label: "financials" },
  { href: "/admin/broadcast", label: "broadcast" },
  { href: "/admin/settings", label: "settings" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  function navigate(href: string) {
    window.location.href = href;
  }

  async function handleLogout() {
    await adminLogout();
    window.location.href = "/login";
  }

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-56 flex-col border-r border-white/5 bg-[#0E0E12] lg:w-60">
      <div className="border-b border-white/5 px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-white">SkillFlow</span>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-black"
            style={{ background: "#FFFF00" }}
          >
            admin
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map(({ href, label, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <button
              key={href}
              type="button"
              onClick={() => navigate(href)}
              className={`relative flex w-full items-center px-5 py-2.5 text-left text-sm font-medium lowercase transition-colors ${
                isActive
                  ? "bg-white/5 text-white"
                  : "text-[#9CA3AF] hover:bg-white/[0.03] hover:text-white"
              }`}
            >
              {isActive ? (
                <span
                  className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r-full"
                  style={{ background: "#FFFF00" }}
                />
              ) : null}
              <span className={isActive ? "text-[#FFFF00]" : ""}>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-white/5 p-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex w-full rounded px-3 py-2 text-left text-sm lowercase text-[#9CA3AF] hover:bg-white/5 hover:text-white"
        >
          back to site
        </button>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full rounded px-3 py-2 text-left text-sm lowercase text-[#9CA3AF] hover:bg-red-500/10 hover:text-red-400"
        >
          sign out
        </button>
      </div>
    </aside>
  );
}
