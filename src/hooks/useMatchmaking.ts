"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  findOrCreateMatch,
  cancelMatch,
  subscribeToMatch,
  type MatchmakingOptions,
  type DbMatch,
} from "@/lib/multiplayer/matchmaking";

export type MatchmakingStatus = "idle" | "searching" | "matched" | "error";

export function useMatchmaking() {
  const [status, setStatus] = useState<MatchmakingStatus>("idle");
  const [match, setMatch] = useState<DbMatch | null>(null);
  const [role, setRole] = useState<"player1" | "player2" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const startMatchmaking = useCallback(async (options: MatchmakingOptions) => {
    setStatus("searching");
    setError(null);
    setMatch(null);
    setRole(null);
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    try {
      const result = await findOrCreateMatch(options);
      setMatch(result.match);
      setRole(result.role);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[useMatchmaking] Match result", {
          id: result.match.id,
          status: result.match.status,
          role: result.role,
        });
      }

      if (result.match.status === "matched") {
        setStatus("matched");
        return;
      }

      unsubscribeRef.current = subscribeToMatch(result.match.id, (updatedMatch: DbMatch) => {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log("[useMatchmaking] Match updated via subscription", {
            id: updatedMatch.id,
            status: updatedMatch.status,
          });
        }
        setMatch(updatedMatch);
        setStatus("matched");
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Matchmaking failed";
      setError(message);
      setStatus("error");
    }
  }, []);

  const cancelSearching = useCallback(async () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (match && match.status === "waiting") {
      try {
        await cancelMatch(match.id);
      } catch {
        // best effort
      }
    }
    setStatus("idle");
    setMatch(null);
    setRole(null);
    setError(null);
  }, [match]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (match?.status === "waiting") {
        cancelMatch(match.id).catch(() => {});
      }
    };
  }, [match?.id, match?.status]);

  return { status, match, role, error, startMatchmaking, cancelSearching };
}
