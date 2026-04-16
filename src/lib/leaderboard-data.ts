import { formatCurrency } from "@/lib/formatCurrency";

/**
 * Generates fake leaderboard data for development.
 * Data is deterministic per seed so it stays stable on re-renders.
 */

const USERNAMES = [
  "ShadowStrike", "NeonViper", "BlitzKing", "IcePhoenix", "DarkMatter", "QuantumAce", "StormBreaker",
  "CyberWolf", "TitanFury", "GhostRider", "VenomPulse", "ZeroGravity", "ThunderBolt", "NightHawk",
  "SteelNerve", "PixelSniper", "OmegaForce", "CrimsonBlade", "ArcticFox", "SonicBoom", "MaverickX",
  "NovaFlare", "RapidFire", "VortexKing", "HyperNova", "CosmicDust", "BlazeRunner", "SilentStorm",
  "IronWill", "TurboCharge", "NexusPoint", "PhantomAce", "EliteForce", "PowerSurge", "MysticWave",
  "RocketFuel", "SharpShot", "WildCard", "BulletProof", "AlphaWolf", "DeltaForce", "EchoStrike",
  "FrostBite", "GridLock", "HeatSeeker", "InfinityX", "JetStream", "KryptonX", "LaserFocus", "MetalGear",
  "NeonPulse", "ShadowBlade", "StormChaser", "VoidWalker", "CrimsonTide",
];

const AVATAR_GRADIENTS = [
  "from-teal/40 to-purple/40",
  "from-amber-500/40 to-rose-500/40",
  "from-emerald-500/40 to-teal/40",
  "from-purple/40 to-pink-500/40",
  "from-rose-500/40 to-purple/40",
  "from-green-500/40 to-emerald-500/40",
  "from-cyan-400/40 to-blue-500/40",
  "from-orange-500/40 to-amber-500/40",
];

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

/** Roughly normal distribution 0..1 using central limit */
function normal(rng: () => number, mean = 0.5, std = 0.15): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += rng();
  const n = (sum / 12 - 0.5) * 2 * std + mean;
  return Math.max(0, Math.min(1, n));
}

export interface LeaderboardPlayer {
  id: string;
  username: string;
  avatarGradient: string;
  skillRating: number;
  totalMatches: number;
  winRate: number;
  totalEarnings: number;
  trend: "up" | "down";
  wins?: number;
  losses?: number;
  topGame?: string;
  isPlaceholder?: boolean;
  isCurrentUser?: boolean;
}

export function generateFakeLeaderboard(
  currentUsername: string | null,
  insertAtPosition: number = 20
): LeaderboardPlayer[] {
  const seed = 42;
  const rng = seededRandom(seed);
  const shuffled = [...USERNAMES].sort(() => rng() - 0.5);
  const players: LeaderboardPlayer[] = [];

  for (let i = 0; i < 50; i++) {
    const name = shuffled[i] || `Player${i + 1}`;

    const winRate = 0.3 + rng() * 0.55;
    const totalMatches = 5 + Math.floor(rng() * 1995);
    const skillRating = Math.round(600 + normal(rng, 0.5, 0.2) * 1600);
    const totalEarnings = Math.round(
      (totalMatches * winRate * (50 + rng() * 200)) * 100
    ) / 100;
    const gradient = AVATAR_GRADIENTS[Math.floor(rng() * AVATAR_GRADIENTS.length)];

    players.push({
      id: `player-${i}-${name}`,
      username: name,
      avatarGradient: gradient,
      skillRating: Math.max(600, Math.min(2200, skillRating)),
      totalMatches,
      winRate: Math.round(winRate * 1000) / 10,
      totalEarnings,
      trend: rng() > 0.5 ? "up" : "down",
    });
  }

  // Sort by earnings for initial order, then we'll re-sort per tab
  players.sort((a, b) => b.totalEarnings - a.totalEarnings);

  if (currentUsername) {
    const devPosition = Math.min(insertAtPosition, Math.max(15, Math.floor(rng() * 16) + 15));
    const balance = typeof window !== "undefined"
      ? parseFloat(localStorage.getItem("skillflow_wallet_balance") || "0") || 0
      : 0;
    const devPlayer: LeaderboardPlayer = {
      id: "current-user",
      username: currentUsername,
      avatarGradient: "from-teal/40 to-purple/40",
      skillRating: 1000,
      totalMatches: 0,
      winRate: 50,
      totalEarnings: balance,
      trend: "up",
      isCurrentUser: true,
    };
    players.splice(devPosition, 0, devPlayer);
  }

  return players;
}

/** Format win rate for display: one decimal, e.g. "61.9%" or "0.0%" when no matches */
export function formatWinRate(rate: number): string {
  const n = Number(rate);
  if (Number.isNaN(n) || n < 0) return "0.0%";
  return `${n.toFixed(1)}%`;
}

export type LeaderboardTab = "earnings" | "winRate" | "matches" | "rating";

export function sortAndRankPlayers(
  players: LeaderboardPlayer[],
  tab: LeaderboardTab
): LeaderboardPlayer[] {
  const sorted = [...players].sort((a, b) => {
    switch (tab) {
      case "earnings":
        return b.totalEarnings - a.totalEarnings;
      case "winRate":
        return b.winRate - a.winRate;
      case "matches":
        return b.totalMatches - a.totalMatches;
      case "rating":
        return b.skillRating - a.skillRating;
      default:
        return 0;
    }
  });
  return sorted;
}

export function getMainStat(player: LeaderboardPlayer, tab: LeaderboardTab): string | number {
  switch (tab) {
    case "earnings":
      return formatCurrency(player.totalEarnings);
    case "winRate":
      return formatWinRate(player.winRate);
    case "matches":
      return player.totalMatches;
    case "rating":
      return player.skillRating;
    default:
      return "";
  }
}

export function getSecondaryStat(player: LeaderboardPlayer, tab: LeaderboardTab): string {
  switch (tab) {
    case "earnings":
    case "winRate":
    case "rating":
      return `${player.totalMatches} matches`;
    case "matches":
      return `${formatCurrency(player.totalEarnings, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} earned`;
    default:
      return "";
  }
}
