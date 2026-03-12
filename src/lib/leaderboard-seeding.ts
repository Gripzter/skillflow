import { SEED_PLAYERS, type SeedPlayer } from "@/lib/seed-leaderboard";
import type { LeaderboardPlayer } from "@/lib/leaderboard-data";

function mapSeedPlayerToLeaderboard(seed: SeedPlayer, gradientIndex: number, gradients: string[]): LeaderboardPlayer {
  const totalMatches = seed.wins + seed.losses;
  // Store seed win rate as a numeric percentage with one decimal place for consistent display
  const winRate = totalMatches ? Math.round((seed.wins / totalMatches) * 1000) / 10 : 0;
  const gradient = gradients[gradientIndex % gradients.length];
  return {
    id: seed.id,
    username: seed.username,
    avatarGradient: gradient,
    skillRating: seed.rating,
    totalMatches,
    winRate,
    totalEarnings: seed.earnings,
    trend: "up",
    wins: seed.wins,
    losses: seed.losses,
    topGame: seed.topGame,
    isPlaceholder: true,
  };
}

const FALLBACK_GRADIENTS: string[] = [
  "from-teal/40 to-purple/40",
  "from-amber-500/40 to-rose-500/40",
  "from-emerald-500/40 to-teal/40",
  "from-purple/40 to-pink-500/40",
  "from-rose-500/40 to-purple/40",
  "from-green-500/40 to-emerald-500/40",
  "from-cyan-400/40 to-blue-500/40",
  "from-orange-500/40 to-amber-500/40",
];

/**
 * Merge real players with seed players and return a ranked top-50 list.
 * Real and seed players are treated identically in the final output.
 */
export function buildLeaderboard(realPlayers: LeaderboardPlayer[], gradients: string[] = FALLBACK_GRADIENTS): LeaderboardPlayer[] {
  const mappedSeeds: LeaderboardPlayer[] = SEED_PLAYERS.map((seed, idx) =>
    mapSeedPlayerToLeaderboard(seed, idx, gradients)
  );

  const combined: LeaderboardPlayer[] = [
    ...realPlayers.map((p) => ({
      ...p,
      isPlaceholder: p.isPlaceholder ?? false,
    })),
    ...mappedSeeds,
  ];

  combined.sort((a, b) => {
    if (b.totalEarnings !== a.totalEarnings) return b.totalEarnings - a.totalEarnings;
    const aWins = a.wins ?? Math.round((a.winRate / 100) * a.totalMatches);
    const bWins = b.wins ?? Math.round((b.winRate / 100) * b.totalMatches);
    return bWins - aWins;
  });

  const maxTotal = 50;
  return combined.slice(0, maxTotal);
}

export function getTopGameEmoji(topGame: string | undefined): string {
  void topGame;
  return "";
}

