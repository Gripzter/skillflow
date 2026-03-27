/**
 * Client-side helper to trigger rating updates after a real-money match.
 * Calls the /api/ranking/update-match API route which uses the service role key
 * to update both players' ratings atomically.
 *
 * This should ONLY be called for real-money matches (not practice).
 */

export interface RatingUpdateResult {
  player1RatingChange: number;
  player2RatingChange: number;
  player1NewRating: number;
  player2NewRating: number;
  player1Tier: string;
  player2Tier: string;
  alreadyProcessed: boolean;
}

export async function updateMatchRating(
  matchId: string,
  player1Id: string,
  player2Id: string,
  gameType: string,
  outcome: "player1" | "player2" | "draw"
): Promise<RatingUpdateResult | null> {
  try {
    const res = await fetch("/api/ranking/update-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, player1Id, player2Id, gameType, outcome }),
    });

    if (!res.ok) {
      console.error("[updateMatchRating] API error:", res.status);
      return null;
    }

    return (await res.json()) as RatingUpdateResult;
  } catch (err) {
    console.error("[updateMatchRating] Fetch error:", err);
    return null;
  }
}

/**
 * Fetch a player's current rating for a specific game.
 * Returns the rating or 1000 (default) if no record exists.
 */
export async function getPlayerGameRating(
  userId: string,
  gameType: string
): Promise<{ rating: number; tier: string; matchesPlayed: number }> {
  try {
    // We import dynamically to keep this file usable in both client and server contexts
    const { createClient } = await import("@/lib/supabase");
    const supabase = createClient();
    if (!supabase) return { rating: 1000, tier: "bronze", matchesPlayed: 0 };

    const { data } = await supabase
      .from("player_ratings")
      .select("rating, tier, matches_played")
      .eq("user_id", userId)
      .eq("game_type", gameType)
      .single();

    if (!data) return { rating: 1000, tier: "bronze", matchesPlayed: 0 };

    return {
      rating: data.rating,
      tier: data.tier,
      matchesPlayed: data.matches_played,
    };
  } catch {
    return { rating: 1000, tier: "bronze", matchesPlayed: 0 };
  }
}
