import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculateNewRatings } from "@/lib/ranking/glicko2";

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface PlayerRatingRow {
  id: string;
  user_id: string;
  game_type: string;
  rating: number;
  rating_deviation: number;
  volatility: number;
  matches_played: number;
  is_placed: boolean;
  last_rated_match_id: string | null;
}

async function getOrCreateRating(
  supabase: SupabaseClient,
  userId: string,
  gameType: string
): Promise<PlayerRatingRow> {
  const { data, error } = await supabase
    .from("player_ratings")
    .select("*")
    .eq("user_id", userId)
    .eq("game_type", gameType)
    .single();

  if (data && !error) return data as PlayerRatingRow;

  // Create default entry
  const { data: created } = await supabase
    .from("player_ratings")
    .insert({
      user_id: userId,
      game_type: gameType,
      rating: 1000,
      rating_deviation: 350,
      volatility: 0.06,
      matches_played: 0,
      is_placed: false,
    })
    .select()
    .single();

  return (created as PlayerRatingRow) ?? {
    id: "",
    user_id: userId,
    game_type: gameType,
    rating: 1000,
    rating_deviation: 350,
    volatility: 0.06,
    matches_played: 0,
    is_placed: false,
    last_rated_match_id: null,
  };
}

/** Weighted average of top 3 games by matches_played */
async function recalcSkillflowScore(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data } = await supabase
    .from("player_ratings")
    .select("rating, matches_played")
    .eq("user_id", userId)
    .gt("matches_played", 0)
    .order("matches_played", { ascending: false })
    .limit(3);

  if (!data || data.length === 0) return 1000;

  const totalMatches = data.reduce((s, r) => s + r.matches_played, 0);
  if (totalMatches === 0) return 1000;

  const weighted = data.reduce(
    (s, r) => s + r.rating * (r.matches_played / totalMatches),
    0
  );
  return Math.round(weighted * 100) / 100;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      matchId: string;
      player1Id: string;
      player2Id: string;
      gameType: string;
      outcome: "player1" | "player2" | "draw";
    };

    const { matchId, player1Id, player2Id, gameType, outcome } = body;

    if (!matchId || !player1Id || !player2Id || !gameType || !outcome) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    // Fetch both players' current ratings
    const [r1, r2] = await Promise.all([
      getOrCreateRating(supabase, player1Id, gameType),
      getOrCreateRating(supabase, player2Id, gameType),
    ]);

    // Idempotency check: if this match was already rated for player1, skip
    if (r1.last_rated_match_id === matchId) {
      return NextResponse.json({
        player1RatingChange: 0,
        player2RatingChange: 0,
        player1NewRating: r1.rating,
        player2NewRating: r2.rating,
        alreadyProcessed: true,
      });
    }

    // Run Glicko-2 calculation
    const result = calculateNewRatings(
      {
        rating: r1.rating,
        rd: r1.rating_deviation,
        volatility: r1.volatility,
        matchesPlayed: r1.matches_played,
      },
      {
        rating: r2.rating,
        rd: r2.rating_deviation,
        volatility: r2.volatility,
        matchesPlayed: r2.matches_played,
      },
      outcome
    );

    const now = new Date().toISOString();
    const p1NewMatches = r1.matches_played + 1;
    const p2NewMatches = r2.matches_played + 1;

    // Cap rating deviation minimum at 30 (highly reliable ratings don't collapse)
    const p1NewRd = Math.max(30, result.player1.rd);
    const p2NewRd = Math.max(30, result.player2.rd);

    const p1NewRating = Math.max(100, result.player1.rating);
    const p2NewRating = Math.max(100, result.player2.rating);

    // Update both players' ratings
    await Promise.all([
      supabase
        .from("player_ratings")
        .update({
          rating: p1NewRating,
          rating_deviation: p1NewRd,
          volatility: result.player1.volatility,
          matches_played: p1NewMatches,
          is_placed: p1NewMatches >= 10,
          last_match_at: now,
          last_rated_match_id: matchId,
        })
        .eq("user_id", player1Id)
        .eq("game_type", gameType),

      supabase
        .from("player_ratings")
        .update({
          rating: p2NewRating,
          rating_deviation: p2NewRd,
          volatility: result.player2.volatility,
          matches_played: p2NewMatches,
          is_placed: p2NewMatches >= 10,
          last_match_at: now,
          last_rated_match_id: matchId,
        })
        .eq("user_id", player2Id)
        .eq("game_type", gameType),
    ]);

    // Recalculate SkillFlow Score for both players (weighted avg of top 3 games)
    const [p1Score, p2Score] = await Promise.all([
      recalcSkillflowScore(supabase, player1Id),
      recalcSkillflowScore(supabase, player2Id),
    ]);

    await Promise.all([
      supabase
        .from("profiles")
        .update({ skillflow_score: p1Score })
        .eq("id", player1Id),
      supabase
        .from("profiles")
        .update({ skillflow_score: p2Score })
        .eq("id", player2Id),
    ]);

    return NextResponse.json({
      player1RatingChange: result.player1.ratingChange,
      player2RatingChange: result.player2.ratingChange,
      player1NewRating: p1NewRating,
      player2NewRating: p2NewRating,
      alreadyProcessed: false,
    });
  } catch (err) {
    console.error("[ranking/update-match]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
