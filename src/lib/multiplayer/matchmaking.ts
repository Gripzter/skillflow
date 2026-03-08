/**
 * Real matchmaking: find or create matches in Supabase.
 * Polling-only — no Supabase Realtime for matchmaking.
 * Realtime is only used inside the match room for game events.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_FEE_PERCENT } from "@/lib/constants";

export interface DbMatch {
  id: string;
  game_type: string;
  player1_id: string;
  player2_id: string | null;
  player1_username: string | null;
  player2_username: string | null;
  player1_rating: number | null;
  player2_rating: number | null;
  stake_amount: number;
  platform_fee: number | null;
  total_pot: number | null;
  winner_payout: number | null;
  status: string;
  result: string | null;
  winner_id: string | null;
  created_at: string;
  completed_at: string | null;
}

const POLL_INTERVAL_MS = 2000;
const MATCHMAKING_TIMEOUT_MS = 60000;

export type MatchmakingStatus = "searching" | "waiting" | "matched" | "timeout";

/**
 * Start matchmaking: search for waiting match → join or create → poll until ready.
 * Returns a cleanup function. Call it on cancel or unmount.
 */
export async function startMatchmaking(
  supabase: SupabaseClient,
  gameType: string,
  stakeAmount: number,
  userId: string,
  username: string,
  rating: number,
  onStatusUpdate: (status: MatchmakingStatus, match?: DbMatch) => void,
  onMatchReady: (match: DbMatch, role: "player1" | "player2") => void,
  onError: (error: string) => void
): Promise<() => void> {
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let matchId: string | null = null;
  let cancelled = false;

  const cleanup = () => {
    cancelled = true;
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  try {
    onStatusUpdate("searching");

    const normalizedGameType = gameType.toLowerCase().trim();
    const stake = Number(stakeAmount);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      onError("Not authenticated");
      return cleanup;
    }

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[matchmaking] Starting matchmaking...", { gameType: normalizedGameType, stake });
    }

    const { data: waitingMatches, error: findError } = await supabase
      .from("matches")
      .select("*")
      .eq("game_type", normalizedGameType)
      .eq("stake_amount", stake)
      .eq("status", "waiting")
      .neq("player1_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (findError) {
      onError(findError.message ?? "Failed to search for matches");
      return cleanup;
    }

    if (waitingMatches && waitingMatches.length > 0) {
      const match = waitingMatches[0] as DbMatch;
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[matchmaking] Found waiting match:", match.id);
      }
      const totalPot = match.stake_amount * 2;
      const platformFee = Math.round(totalPot * PLATFORM_FEE_PERCENT * 100) / 100;
      const winnerPayout = Math.round((totalPot - platformFee) * 100) / 100;

      const { data: updated, error: joinError } = await supabase
        .from("matches")
        .update({
          player2_id: userId,
          player2_username: username,
          player2_rating: rating,
          status: "matched",
          total_pot: totalPot,
          platform_fee: platformFee,
          winner_payout: winnerPayout,
        })
        .eq("id", match.id)
        .eq("status", "waiting")
        .select()
        .single();

      if (joinError || !updated) {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log("[matchmaking] Join failed (match taken?), retrying…", joinError?.message);
        }
        return startMatchmaking(
          supabase,
          gameType,
          stakeAmount,
          userId,
          username,
          rating,
          onStatusUpdate,
          onMatchReady,
          onError
        );
      }

      matchId = (updated as DbMatch).id;
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[matchmaking] Player 2 joined match:", matchId, "— calling onMatchReady NOW (no delay)");
      }
      onStatusUpdate("matched", updated as DbMatch);
      if (!cancelled) {
        onMatchReady(updated as DbMatch, "player2");
      }
      return cleanup;
    }

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[matchmaking] No waiting match found, creating new...");
    }

    const { data: newMatch, error: createError } = await supabase
      .from("matches")
      .insert({
        game_type: normalizedGameType,
        stake_amount: stake,
        player1_id: userId,
        player1_username: username,
        player1_rating: rating,
        status: "waiting",
      })
      .select()
      .single();

    if (createError) {
      onError(createError.message ?? "Failed to create match");
      return cleanup;
    }
    if (!newMatch) {
      onError("Failed to create match");
      return cleanup;
    }

    matchId = (newMatch as DbMatch).id;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[matchmaking] Created match as Player 1:", matchId, "— starting polling every 2s");
    }
    onStatusUpdate("waiting", newMatch as DbMatch);

    pollInterval = setInterval(async () => {
      if (cancelled) {
        // eslint-disable-next-line no-console
        console.log("[matchmaking] Polling cancelled, stopping");
        return;
      }

      try {
        const { data: freshMatch, error: pollError } = await supabase
          .from("matches")
          .select("*")
          .eq("id", matchId)
          .single();

        if (pollError) {
          // eslint-disable-next-line no-console
          console.error("[matchmaking] Poll query error:", pollError);
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log("[matchmaking] Poll check:", (freshMatch as DbMatch)?.status, "player2_id:", (freshMatch as DbMatch)?.player2_id);
        }

        if (
          freshMatch &&
          (freshMatch as DbMatch).status === "matched" &&
          (freshMatch as DbMatch).player2_id
        ) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.log("[matchmaking] Player 1 matched! Calling onMatchReady NOW (no delay), NAVIGATING TO:", `/match/${(freshMatch as DbMatch).id}`);
          }
          onStatusUpdate("matched", freshMatch as DbMatch);
          if (!cancelled) {
            onMatchReady(freshMatch as DbMatch, "player1");
          }
        }
      } catch (pollErr) {
        // eslint-disable-next-line no-console
        console.error("[matchmaking] Poll error:", pollErr);
      }
    }, POLL_INTERVAL_MS);

    const timeoutId = setTimeout(() => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (!cancelled) onStatusUpdate("timeout");
    }, MATCHMAKING_TIMEOUT_MS);

    return () => {
      cleanup();
      clearTimeout(timeoutId);
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Matchmaking failed";
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[matchmaking] Error:", err);
    }
    onError(message);
    return cleanup;
  }
}

/**
 * Cancel a waiting match (e.g. when Player 1 clicks Cancel).
 */
export async function cancelMatchmaking(
  supabase: SupabaseClient,
  matchId: string
): Promise<void> {
  await supabase
    .from("matches")
    .update({ status: "cancelled" })
    .eq("id", matchId)
    .eq("status", "waiting");
}

/**
 * Mark match as completed with winner and result (used from match room / API).
 */
export async function completeMatch(
  supabase: SupabaseClient,
  matchId: string,
  winnerId: string | null,
  result: "player1_win" | "player2_win" | "draw"
): Promise<DbMatch> {
  const { data, error } = await supabase
    .from("matches")
    .update({
      winner_id: winnerId,
      result,
      status: result === "draw" ? "draw" : "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Match not found");
  return data as DbMatch;
}
