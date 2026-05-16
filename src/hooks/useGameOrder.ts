"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { PlayGameCard } from "@/hooks/useGames";

export function useGameOrder(baseGames: PlayGameCard[], userId: string | null) {
  const [orderedGames, setOrderedGames] = useState<PlayGameCard[]>(baseGames);

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      if (!userId) {
        setOrderedGames(baseGames);
        return;
      }

      const supabase = createClient();
      if (!supabase) {
        setOrderedGames(baseGames);
        return;
      }

      const { data, error } = await supabase
        .from("matches")
        .select("game_type")
        .or(`winner_id.eq.${userId},loser_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (cancelled || error || !data) {
        if (!cancelled) setOrderedGames(baseGames);
        return;
      }

      const playCount: Record<string, number> = {};
      for (const row of data) {
        const gameType = String((row as { game_type?: string | null }).game_type ?? "");
        if (gameType) {
          playCount[gameType] = (playCount[gameType] || 0) + 1;
        }
      }

      const indexBySlug = new Map(baseGames.map((game, index) => [game.slug, index]));

      const sorted = [...baseGames].sort((a, b) => {
        const aCount = playCount[a.slug] || 0;
        const bCount = playCount[b.slug] || 0;
        if (aCount !== bCount) return bCount - aCount;
        return (indexBySlug.get(a.slug) ?? 0) - (indexBySlug.get(b.slug) ?? 0);
      });

      if (!cancelled) setOrderedGames(sorted);
    }

    void loadOrder();

    return () => {
      cancelled = true;
    };
  }, [userId, baseGames]);

  return orderedGames;
}
