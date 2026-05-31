"use client";

import { useEffect, useState } from "react";
import { getMatches } from "@/lib/api";

export type RecentMatch = {
  id: string;
  resultLabel: "Won" | "Lost";
  opponent: string;
  spDelta: number;
  createdAt: string;
  timeAgo: string;
};

function formatRelativeTime(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function useRecentMatches({
  limit = 1,
  username,
  enabled = true,
}: {
  limit?: number;
  username: string;
  enabled?: boolean;
}) {
  const [matches, setMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!enabled) {
        setMatches([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const all = await getMatches();
      const completed = all
        .filter((m) => m.status === "completed")
        .slice(0, limit)
        .map((m) => {
          const userIsPlayer1 = m.player1.username === username;
          const won =
            m.winner &&
            ((m.winner === "player1" && userIsPlayer1) ||
              (m.winner === "player2" && !userIsPlayer1));
          const opponent = userIsPlayer1 ? m.player2.username : m.player1.username;
          return {
            id: m.id,
            resultLabel: won ? "Won" : "Lost",
            opponent,
            spDelta: won ? 100 : 25,
            createdAt: m.createdAt,
            timeAgo: formatRelativeTime(m.createdAt),
          };
        });

      if (!cancelled) {
        setMatches(completed);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, limit, username]);

  return { matches, loading };
}
