import type { PlayerDailyChallenge } from "@/lib/challengeProgress";
import { CHALLENGE_GAME_TO_SLUG } from "@/lib/challengeGames";
import { toLegacyChallengeRow, type DailyChallengeRow } from "@/lib/daily-challenges";

export {
  getPlayerDailyChallenges,
  incrementChallengeProgress,
  claimChallengeReward,
  notifyChallengeProgressFromClient,
  type PlayerDailyChallenge,
} from "@/lib/challengeProgress";

export { getOrCreateTodaysChallenges, forceRotateTodaysChallenges } from "@/lib/challengeRotation";

export type { DailyChallengeRow } from "@/lib/daily-challenges";
export { toLegacyChallengeRow };

/** @deprecated Use getPlayerDailyChallenges via /api/challenges */
export async function getDailyChallenges(userId: string): Promise<DailyChallengeRow[]> {
  const { getPlayerDailyChallenges } = await import("@/lib/challengeProgress");
  const rows = await getPlayerDailyChallenges(userId);
  return rows.map(toLegacyChallengeRow);
}

/** @deprecated Use notifyChallengeProgressFromClient */
export async function updateChallengeProgress(
  userId: string,
  eventType: string,
  gameType?: string
): Promise<DailyChallengeRow[]> {
  const { notifyChallengeProgressFromClient } = await import("@/lib/challengeProgress");
  await notifyChallengeProgressFromClient(userId, gameType ?? "", eventType === "match_win");
  return [];
}
