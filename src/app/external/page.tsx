"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import { getCurrentUser } from "@/lib/api";

const EXTERNAL_GAMES = [
  {
    slug: "cs2",
    name: "Counter-Strike 2",
    tags: ["1v1", "5v5", "PC"],
    gradient: "from-blue-900/80 to-orange-600/80",
    status: "active" as const,
    playersOnline: "2,847 players",
  },
  {
    slug: "sim-racing",
    name: "Sim Racing",
    tags: ["1v1", "League", "PC"],
    gradient: "from-red-900/80 to-black/80",
    status: "coming-soon" as const,
    playersOnline: "Coming Soon",
  },
  {
    slug: "ea-fc-25",
    name: "EA FC 25",
    tags: ["1v1", "Console", "PC"],
    gradient: "from-green-700/80 to-green-950/80",
    status: "coming-soon" as const,
    playersOnline: "Coming Soon",
  },
  {
    slug: "rocket-league",
    name: "Rocket League",
    tags: ["1v1", "2v2", "PC", "Console"],
    gradient: "from-blue-600/80 to-purple-700/80",
    status: "coming-soon" as const,
    playersOnline: "Coming Soon",
  },
  {
    slug: "nba-2k",
    name: "NBA 2K25",
    tags: ["1v1", "Console", "PC"],
    gradient: "from-orange-600/80 to-red-600/80",
    status: "coming-soon" as const,
    playersOnline: "Coming Soon",
  },
  {
    slug: "cod",
    name: "Call of Duty",
    tags: ["1v1", "PC", "Console"],
    gradient: "from-green-900/80 to-black/80",
    status: "coming-soon" as const,
    playersOnline: "Coming Soon",
  },
];

export default function ExternalGamesHubPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string>("Player");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUsername(user.username);
        setIsDevMode(user.isDevMode ?? false);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { logout } = await import("@/lib/api");
      await logout();
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <svg className="h-10 w-10 animate-spin text-teal" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal">
      <div
        className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-orange-950/10 via-transparent to-transparent" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="external"
      />
      <main className="relative mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="border-b border-orange-500/20 pb-6">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Arena 🎮</h1>
          <p className="mt-2 text-lg text-body-gray">
            Wager on your skill in real games. Play on your platform, win on ours.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {EXTERNAL_GAMES.map((game) => {
            const isActive = game.status === "active";
            const content = (
              <div
                className={`card-border relative flex min-h-[200px] flex-col justify-between overflow-hidden rounded-card p-5 transition-all duration-200 ${
                  isActive
                    ? "cursor-pointer hover:-translate-y-1 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10"
                    : "cursor-not-allowed opacity-60"
                }`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${game.gradient}`}
                  aria-hidden
                />
                <div className="absolute inset-0 bg-black/40" aria-hidden />
                <div className="relative">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isActive ? "bg-teal/30 text-teal" : "bg-white/20 text-body-gray"
                    }`}
                  >
                    {game.status === "active" ? "Active" : "Coming Soon"}
                  </span>
                  <p className="mt-3 text-lg font-bold text-white">{game.name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {game.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-white/10 px-2 py-0.5 text-xs text-body-gray"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="relative mt-4 flex items-center justify-between">
                  <p className="text-sm text-body-gray">{game.playersOnline}</p>
                  {!isActive && (
                    <button
                      type="button"
                      onClick={(e) => e.preventDefault()}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-body-gray hover:bg-white/5"
                    >
                      Notify Me
                    </button>
                  )}
                </div>
                {isActive && (
                  <div className="absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                    <span className="text-xs text-teal">→ Play</span>
                  </div>
                )}
              </div>
            );

            if (isActive && game.slug === "cs2") {
              return (
                <Link key={game.slug} href={`/external/${game.slug}`} className="group">
                  {content}
                </Link>
              );
            }
            return <div key={game.slug}>{content}</div>;
          })}
        </div>
      </main>
    </div>
  );
}
