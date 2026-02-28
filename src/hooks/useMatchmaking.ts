"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import {
  startMatchmaking as startMatchmakingApi,
  cancelMatchmaking,
  type DbMatch,
} from "@/lib/multiplayer/matchmaking";

export type MatchmakingStatus =
  | "idle"
  | "searching"
  | "waiting"
  | "matched"
  | "timeout"
  | "error";

export interface MatchmakingOptions {
  gameType: string;
  stakeAmount: number;
  userId: string;
  username: string;
  rating: number;
  onMatchReady?: (match: DbMatch, role: "player1" | "player2") => void;
}

export function useMatchmaking() {
  const [status, setStatus] = useState<MatchmakingStatus>("idle");
  const [match, setMatch] = useState<DbMatch | null>(null);
  const [role, setRole] = useState<"player1" | "player2" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const startMatchmaking = useCallback(async (options: MatchmakingOptions) => {
    setStatus("searching");
    setError(null);
    setMatch(null);
    setRole(null);
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase not configured");
      setStatus("error");
      return;
    }

    try {
      cleanupRef.current = await startMatchmakingApi(
        supabase,
        options.gameType,
        options.stakeAmount,
        options.userId,
        options.username,
        options.rating,
        (updateStatus, matchData) => {
          setStatus(updateStatus as MatchmakingStatus);
          if (matchData) setMatch(matchData);
        },
        (matchData, matchRole) => {
          setMatch(matchData);
          setRole(matchRole);
          setStatus("matched");
          options.onMatchReady?.(matchData, matchRole);
        },
        (err) => {
          setError(err);
          setStatus("error");
        }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Matchmaking failed";
      setError(message);
      setStatus("error");
    }
  }, []);

  const cancelSearching = useCallback(async () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    const currentMatch = match;
    if (currentMatch?.status === "waiting") {
      const supabase = createClient();
      if (supabase) {
        try {
          await cancelMatchmaking(supabase, currentMatch.id);
        } catch {
          // best effort
        }
      }
    }
    setStatus("idle");
    setMatch(null);
    setRole(null);
    setError(null);
  }, [match]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (match?.status === "waiting") {
        const supabase = createClient();
        if (supabase) {
          cancelMatchmaking(supabase, match.id).catch(() => {});
        }
      }
    };
  }, [match?.id, match?.status]);

  return { status, match, role, error, startMatchmaking, cancelSearching };
}
