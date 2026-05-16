"use client";

import { useEffect, useState } from "react";
import { getDailyChallenges, type DailyChallengeRow } from "@/lib/daily-challenges";

export function useDailyChallenges(userId: string, limit = 3) {
  const [challenges, setChallenges] = useState<DailyChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) {
        setChallenges([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const rows = await getDailyChallenges(userId);
      if (!cancelled) {
        setChallenges(rows.slice(0, limit));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, limit]);

  return { challenges, loading };
}
