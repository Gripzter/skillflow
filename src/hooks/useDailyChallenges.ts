"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { PlayerDailyChallenge } from "@/lib/challengeProgress";

export function useDailyChallenges(enabled = true) {
  const [challenges, setChallenges] = useState<PlayerDailyChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!enabled) {
      setChallenges([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const headers: Record<string, string> = {};
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      const res = await fetch("/api/challenges", { headers });
      if (!res.ok) {
        setChallenges([]);
        return;
      }
      const data = (await res.json()) as { challenges?: PlayerDailyChallenge[] };
      setChallenges(data.challenges ?? []);
    } catch {
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { challenges, loading, refresh: load };
}
