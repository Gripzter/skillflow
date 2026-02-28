"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  findOrCreateMatch,
  cancelMatch,
  subscribeToMatch,
  fetchMatch,
  type MatchmakingOptions,
  type DbMatch,
} from "@/lib/multiplayer/matchmaking";

export type MatchmakingStatus = "idle" | "searching" | "matched" | "error";

const POLL_INTERVAL_MS = 2000;

export function useMatchmaking() {
  const [status, setStatus] = useState<MatchmakingStatus>("idle");
  const [match, setMatch] = useState<DbMatch | null>(null);
  const [role, setRole] = useState<"player1" | "player2" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearWaitingState = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startMatchmaking = useCallback(async (options: MatchmakingOptions) => {
    setStatus("searching");
    setError(null);
    setMatch(null);
    setRole(null);
    clearWaitingState();

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

      const matchId = result.match.id;

      const onMatched = (updatedMatch: DbMatch) => {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log("[useMatchmaking] Match matched", {
            id: updatedMatch.id,
            status: updatedMatch.status,
          });
        }
        clearWaitingState();
        setMatch(updatedMatch);
        setStatus("matched");
      };

      unsubscribeRef.current = subscribeToMatch(matchId, onMatched);

      pollIntervalRef.current = setInterval(async () => {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log("[useMatchmaking] Polling match status…", matchId);
        }
        const fetched = await fetchMatch(matchId);
        if (fetched && fetched.status === "matched") {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.log("[useMatchmaking] Match found via polling");
          }
          onMatched(fetched);
        }
      }, POLL_INTERVAL_MS);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Matchmaking failed";
      setError(message);
      setStatus("error");
      clearWaitingState();
    }
  }, [clearWaitingState]);

  const cancelSearching = useCallback(async () => {
    clearWaitingState();
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
  }, [match, clearWaitingState]);

  useEffect(() => {
    return () => {
      clearWaitingState();
      if (match?.status === "waiting") {
        cancelMatch(match.id).catch(() => {});
      }
    };
  }, [match?.id, match?.status, clearWaitingState]);

  return { status, match, role, error, startMatchmaking, cancelSearching };
}
