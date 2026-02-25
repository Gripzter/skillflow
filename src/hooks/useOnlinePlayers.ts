"use client";

import { useState, useEffect } from "react";
import { subscribeOnlinePresence } from "@/lib/multiplayer/realtime";

/**
 * Returns the number of players currently online (tracked via Supabase Presence on "online_players" channel).
 * When real count < 5, returns a fake count (50–150) so the lobby doesn't look empty.
 * Pass userId when authenticated (real user); when empty or dev mode, returns a fallback count.
 */
export function useOnlinePlayers(userId: string | undefined): number {
  const [count, setCount] = useState(50);

  useEffect(() => {
    if (!userId) {
      setCount(50 + Math.floor(Math.random() * 101));
      return;
    }
    const unsubscribe = subscribeOnlinePresence(userId, setCount);
    return unsubscribe;
  }, [userId]);

  return count;
}
