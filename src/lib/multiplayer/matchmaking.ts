/**
 * Real matchmaking: find or create matches in Supabase, subscribe to match updates.
 * Used only for non–dev-mode (real Supabase) users.
 */

import { createClient } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface MatchmakingOptions {
  gameType: string;
  stakeAmount: number;
  userId: string;
  username: string;
  rating: number;
}

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

export type MatchmakingResult = { match: DbMatch; role: "player1" | "player2" };

function getSupabase() {
  return createClient();
}

/**
 * Find an existing waiting match with same game type and stake, or create a new one.
 */
export async function findOrCreateMatch(options: MatchmakingOptions): Promise<MatchmakingResult> {
  const { gameType, stakeAmount, userId, username, rating } = options;
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const { data: waitingMatches, error: findError } = await supabase
    .from("matches")
    .select("*")
    .eq("game_type", gameType)
    .eq("stake_amount", stakeAmount)
    .eq("status", "waiting")
    .neq("player1_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (findError) throw findError;

  if (waitingMatches && waitingMatches.length > 0) {
    const match = waitingMatches[0] as DbMatch;
    const totalPot = match.stake_amount * 2;
    const platformFee = Math.round(totalPot * 0.03 * 100) / 100;
    const winnerPayout = Math.round((totalPot - platformFee) * 100) / 100;

    const { data: updatedMatch, error: updateError } = await supabase
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

    if (updateError) throw updateError;

    if (!updatedMatch) {
      return findOrCreateMatch(options);
    }

    return { match: updatedMatch as DbMatch, role: "player2" };
  }

  const { data: newMatch, error: createError } = await supabase
    .from("matches")
    .insert({
      game_type: gameType,
      player1_id: userId,
      player1_username: username,
      player1_rating: rating,
      stake_amount: stakeAmount,
      status: "waiting",
    })
    .select()
    .single();

  if (createError) throw createError;
  if (!newMatch) throw new Error("Failed to create match");

  return { match: newMatch as DbMatch, role: "player1" };
}

/**
 * Cancel a waiting match (creator only). Caller should refund stake after.
 */
export async function cancelMatch(matchId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase
    .from("matches")
    .update({ status: "cancelled" })
    .eq("id", matchId)
    .eq("status", "waiting");

  if (error) throw error;
}

/**
 * Subscribe to match row updates (e.g. when opponent joins and status becomes 'matched').
 * Returns unsubscribe function.
 */
export function subscribeToMatch(
  matchId: string,
  onMatched: (match: DbMatch) => void
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase
    .channel(`matchmaking:${matchId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "matches",
        filter: `id=eq.${matchId}`,
      },
      (payload: { new: DbMatch }) => {
        if (payload.new?.status === "matched") {
          onMatched(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

/**
 * Mark match as completed with winner and result. Caller should credit winner / refund draw via API.
 */
export async function completeMatch(
  matchId: string,
  winnerId: string | null,
  result: "player1_win" | "player2_win" | "draw"
): Promise<DbMatch> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

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
