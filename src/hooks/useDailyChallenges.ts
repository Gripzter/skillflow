"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { PlayerDailyChallenge } from "@/lib/challengeProgress";

export function useDailyChallenges(enabled = true) {
  const [challenges, setChallenges] = useState<PlayerDailyChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const load = useCallback(
    async (force = false) => {
      if (!enabled) {
        setChallenges([]);
        setLoading(false);
        loadedRef.current = false;
        return;
      }

      if (!force && loadedRef.current) {
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
          loadedRef.current = false;
          return;
        }
        const data = (await res.json()) as { challenges?: PlayerDailyChallenge[] };
        setChallenges(data.challenges ?? []);
        loadedRef.current = true;
      } catch {
        setChallenges([]);
        loadedRef.current = false;
      } finally {
        setLoading(false);
      }
    },
    [enabled]
  );

  useEffect(() => {
    loadedRef.current = false;
    void load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { challenges, loading, refresh };
}
