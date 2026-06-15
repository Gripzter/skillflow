import { NextRequest, NextResponse } from "next/server";
import { incrementChallengeProgress } from "@/lib/challengeProgress";
import { toChallengeGameId } from "@/lib/challengeGames";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    userId?: string;
    gameType?: string;
    eventType?: "match_played" | "match_won";
  };

  const userId = body.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const gameId = body.gameType ? toChallengeGameId(body.gameType) : null;
  const eventType = body.eventType;

  if (!gameId || !eventType) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const challenges = await incrementChallengeProgress(userId, gameId, eventType);
  return NextResponse.json({ challenges });
}
