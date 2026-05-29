"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { getUserFriendlyError } from "@/lib/errorHandler";
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
  isRealMoney?: boolean;
  onMatchReady?: (match: DbMatch, role: "player1" | "player2") => void;
}

export function useMatchmaking() {
  const [status, setStatus] = useState<MatchmakingStatus>("idle");
  const [match, setMatch] = useState<DbMatch | null>(null);
  const [role, setRole] = useState<"player1" | "player2" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const matchRef = useRef<DbMatch | null>(null);
  matchRef.current = match;

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
      setError("Service is temporarily unavailable. Please try again later.");
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
        options.isRealMoney ?? false,
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
          // eslint-disable-next-line no-console
          console.error("[useMatchmaking] startMatchmakingApi onError:", err);
          setError(getUserFriendlyError({ message: err }));
          setStatus("error");
        }
      );
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error("[useMatchmaking] startMatchmaking threw:", err);
      const message = getUserFriendlyError(err);
      setError(message);
      setStatus("error");
    }
  }, []);

  const cancelSearching = useCallback(async () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    const currentMatch = matchRef.current;
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
  }, []);

  // Cleanup only on unmount — do NOT depend on match/status or we kill the 2s delay before onMatchReady
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      const currentMatch = matchRef.current;
      if (currentMatch?.status === "waiting") {
        const supabase = createClient();
        if (supabase) {
          cancelMatchmaking(supabase, currentMatch.id).catch(() => {});
        }
      }
    };
  }, []);

  return { status, match, role, error, startMatchmaking, cancelSearching };
}
