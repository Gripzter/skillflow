/**
 * Real matchmaking: find or create matches in Supabase.
 * Polling-only — no Supabase Realtime for matchmaking.
 * Realtime is only used inside the match room for game events.
 *
 * Rating-based matching window (ranked play):
 *   first 5 s → opponent within ±200 rating points
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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

const POLL_INTERVAL_MS = 1000;
const MATCHMAKING_TIMEOUT_MS = 5000;
const RATING_MATCH_RANGE = 200;

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
  isRealMoney: boolean,
  onStatusUpdate: (status: MatchmakingStatus, match?: DbMatch) => void,
  onMatchReady: (match: DbMatch, role: "player1" | "player2") => void,
  onError: (error: string) => void
): Promise<() => void> {
  let pollInterval: ReturnType<typeof setInterval> | null = null;
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
    const searchStart = Date.now();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      onError("Not authenticated");
      return cleanup;
    }

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[matchmaking] Starting matchmaking...", { gameType: normalizedGameType, stake, isRealMoney, rating });
    }

    /** Search for a waiting match respecting the current rating filter */
    async function findWaitingMatch(): Promise<DbMatch | null> {
      let query = supabase
        .from("matches")
        .select("*")
        .eq("game_type", normalizedGameType)
        .eq("stake_amount", stake)
        .eq("status", "waiting")
        .neq("player1_id", userId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (isRealMoney) {
        query = query
          .gte("player1_rating", rating - RATING_MATCH_RANGE)
          .lte("player1_rating", rating + RATING_MATCH_RANGE);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) return null;
      return data[0] as DbMatch;
    }

    /** Attempt to join a waiting match as player 2 */
    async function joinMatch(match: DbMatch): Promise<DbMatch | null> {
      const totalPot = match.stake_amount * 2;
      const platformFee = 0;
      const winnerPayout = totalPot;

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
        .eq("status", "waiting") // optimistic lock — fails if already taken
        .select()
        .single();

      if (joinError || !updated) return null;
      return updated as DbMatch;
    }

    // ── Initial search ────────────────────────────────────────────────────────

    const initialMatch = await findWaitingMatch();

    if (initialMatch) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[matchmaking] Found waiting match:", initialMatch.id);
      }
      const joined = await joinMatch(initialMatch);
      if (joined) {
        onStatusUpdate("matched", joined);
        if (!cancelled) onMatchReady(joined, "player2");
        return cleanup;
      }
      // Race condition — someone else grabbed it; fall through to create
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[matchmaking] Join failed (match taken?), creating new…");
      }
    }

    // ── Create a waiting match ────────────────────────────────────────────────

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

    const myMatchId = (newMatch as DbMatch).id;
    let myMatchActive = true;

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[matchmaking] Created match as Player 1:", myMatchId, "— polling every 2s");
    }
    onStatusUpdate("waiting", newMatch as DbMatch);

    // ── Poll: wait for player2 OR find a better match ─────────────────────────

    pollInterval = setInterval(async () => {
      if (cancelled) return;

      // Global timeout
      if (Date.now() - searchStart >= MATCHMAKING_TIMEOUT_MS) {
        clearInterval(pollInterval!);
        pollInterval = null;
        if (!cancelled) onStatusUpdate("timeout");
        return;
      }

      try {
        // 1. Check if someone joined our match
        if (myMatchActive) {
          const { data: freshMatch, error: pollError } = await supabase
            .from("matches")
            .select("*")
            .eq("id", myMatchId)
            .single();

          if (pollError) {
            // eslint-disable-next-line no-console
            console.error("[matchmaking] Poll query error:", pollError);
          } else if (
            freshMatch &&
            (freshMatch as DbMatch).status === "matched" &&
            (freshMatch as DbMatch).player2_id
          ) {
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.log("[matchmaking] Player 1 matched! Navigating to:", `/match/${(freshMatch as DbMatch).id}`);
            }
            clearInterval(pollInterval!);
            pollInterval = null;
            onStatusUpdate("matched", freshMatch as DbMatch);
            if (!cancelled) {
              setTimeout(() => onMatchReady(freshMatch as DbMatch, "player1"), 500);
            }
            return;
          }
        }

        // 2. Also look for OTHER waiting matches to join during the search window
        if (myMatchActive) {
          const otherMatch = await findWaitingMatch();
          if (otherMatch) {
            const joined = await joinMatch(otherMatch);
            if (joined) {
              // Cancel our own waiting match before navigating
              myMatchActive = false;
              supabase
                .from("matches")
                .update({ status: "cancelled" })
                .eq("id", myMatchId)
                .eq("status", "waiting")
                .then(() => {})
                .catch(() => {});

              clearInterval(pollInterval!);
              pollInterval = null;
              onStatusUpdate("matched", joined);
              if (!cancelled) onMatchReady(joined, "player2");
            }
          }
        }
      } catch (pollErr) {
        // eslint-disable-next-line no-console
        console.error("[matchmaking] Poll error:", pollErr);
      }
    }, POLL_INTERVAL_MS);

    return cleanup;
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
