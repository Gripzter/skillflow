import type { PlayerDailyChallenge } from "@/lib/challengeProgress";
import { CHALLENGE_GAME_TO_SLUG } from "@/lib/challengeGames";

export {
  getPlayerDailyChallenges,
  incrementChallengeProgress,
  claimChallengeReward,
  notifyChallengeProgressFromClient,
  type PlayerDailyChallenge,
} from "@/lib/challengeProgress";

export { getOrCreateTodaysChallenges, forceRotateTodaysChallenges } from "@/lib/challengeRotation";

/** @deprecated Use PlayerDailyChallenge from @/lib/challengeProgress */
export type DailyChallengeRow = {
  id: string;
  description: string;
  target: number;
  progress: number;
  reward_sp: number;
  completed: boolean;
  claimed: boolean;
  game_slug: string | null;
};

export function toLegacyChallengeRow(c: PlayerDailyChallenge): DailyChallengeRow {
  return {
    id: c.slotId,
    description: c.title,
    target: c.targetValue,
    progress: c.progress,
    reward_sp: c.rewardSk,
    completed: c.completed,
    claimed: c.rewardClaimed,
    game_slug: CHALLENGE_GAME_TO_SLUG[c.game],
  };
}

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
