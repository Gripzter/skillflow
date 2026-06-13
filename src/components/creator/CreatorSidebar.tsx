"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { CreatorStatus } from "@/hooks/useCreatorData";

const NAV_ITEMS = [
  { href: "/creator", label: "overview", exact: true },
  { href: "/creator/earnings", label: "earnings" },
  { href: "/creator/matches", label: "match logs" },
  { href: "/creator/credentials", label: "sdk credentials" },
  { href: "/creator/docs", label: "documentation" },
];

type CreatorSidebarProps = {
  gameName?: string;
  status?: CreatorStatus;
};

export default function CreatorSidebar({ gameName }: CreatorSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function navigate(href: string) {
    setMobileOpen(false);
    window.location.href = href;
  }

  async function handleSignOut() {
    const { createClient } = await import("@/lib/supabase");
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const navContent = (
    <>
      <div className="border-b border-white/5 px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-white">SkillFlow</span>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-black"
            style={{ background: "#FFFF00" }}
          >
            creator
          </span>
        </div>
        {gameName ? (
          <p className="mt-2 truncate text-xs lowercase text-[#7A7A8E]">{gameName}</p>
        ) : null}
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
          className="flex w-full items-center rounded px-3 py-2 text-left text-sm lowercase text-[#9CA3AF] transition-colors hover:bg-white/5 hover:text-white"
        >
          back to skillflow
        </button>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex w-full items-center rounded px-3 py-2 text-left text-sm lowercase text-[#9CA3AF] transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-white/5 bg-[#0E0E12] px-4 py-3 lg:hidden">
        <span className="text-sm font-bold text-white">skillflow creator</span>
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="rounded border border-white/10 px-3 py-1.5 text-xs lowercase text-[#C8C8D4]"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? "close" : "menu"}
        </button>
      </header>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-white/5 bg-[#0E0E12] transition-transform lg:w-60 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}

export function CreatorStatusBadge({ status }: { status: CreatorStatus }) {
  const styles: Record<CreatorStatus, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    pending: "bg-[#FFFF00]/15 text-[#FFFF00] border-[#FFFF00]/30",
    suspended: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function CreatorWarningBanner({ status }: { status: CreatorStatus }) {
  if (status === "active") return null;

  if (status === "pending") {
    return (
      <div className="mb-6 rounded-lg border border-[#FFFF00]/30 bg-[#FFFF00]/10 px-4 py-3 text-sm text-[#FFFF00]">
        your game is pending review. you will be notified when approved.
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      your game has been suspended. contact{" "}
      <a href="mailto:support@skillflow.gg" className="underline">
        support@skillflow.gg
      </a>
      . dashboard is read-only.
    </div>
  );
}

export function CreatorStatCard({
  label,
  value,
  subValue,
  valueClassName = "text-[#FFFF00]",
}: {
  label: string;
  value: string;
  subValue?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
      <p className="text-xs lowercase tracking-wide text-[#7A7A8E]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClassName}`}>{value}</p>
      {subValue ? <p className="mt-1 text-sm text-[#C8C8D4]">{subValue}</p> : null}
    </div>
  );
}

export function CreatorLoadingSpinner() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]"
        aria-label="loading"
      />
    </div>
  );
}
