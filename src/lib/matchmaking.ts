/**
 * Matchmaking utilities for dev mode (simulated opponents and match storage).
 */

import { generateId } from "./wallet";

export const MATCHES_STORAGE_KEY = "skillflow_matches";

const OPPONENT_NAMES = [
  "xKira",
  "Noctis",
  "ZeroDay",
  "Mellowz",
  "Clutchh",
  "Sova99",
  "Jinxed",
  "Phantom",
  "Ace_High",
  "Koda",
  "NovaByte",
  "RiftRunner",
  "Vanta",
  "MiraQ",
  "Skylark",
  "Nexu",
  "Cinder",
  "AriaX",
  "Luma",
  "EchoNine",
  "Warden",
  "Astra",
  "Ghostline",
  "RogueMint",
  "PixelRush",
  "Zenith",
  "Pulse",
  "Drift",
  "Blitz",
  "Hexa",
  "Kairo",
  "Nori",
  "Vex",
  "Frosty",
  "Nebula",
  "Rune",
  "Axiom",
  "Flare",
  "Orbit",
  "Havoc",
  "Raven",
  "Volt",
  "Solace",
  "Cipher",
  "Mako",
  "Lyric",
  "Raze",
  "Basilisk",
  "Onyx",
  "Prism",
  "Tundra",
  "EchoFox",
];

export interface PlayerInfo {
  username: string;
  rating: number;
  winRate: number;
  matchesPlayed: number;
}

export interface ConnectionSnapshot {
  timestamp: string;
  ping: number;
  jitter: number;
  packetLoss: number;
  rating: string;
}

export interface ConnectionWarningAck {
  timestamp: string;
  rating: "warning" | "unrecommended";
}

export interface StoredMatch {
  id: string;
  gameType: string;
  gameDisplayName: string;
  player1: PlayerInfo;
  player2: PlayerInfo;
  stakeAmount: number;
  platformFee: number;
  totalPot: number;
  winnerPayout: number;
  status: "in_progress" | "completed";
  winner?: "player1" | "player2";
  createdAt: string;
  connectionLog?: ConnectionSnapshot[];
  connectionWarningAcknowledged?: false | ConnectionWarningAck;
  /** When true, match is from practice storage; no wallet impact */
  isPractice?: boolean;
  /** When true, match is real multiplayer (two humans); use realtime channel */
  isRealMultiplayer?: boolean;
  /** Real match: player user IDs for role resolution */
  player1Id?: string;
  player2Id?: string;
  /** Real match flag for bot opponents */
  isBot?: boolean;
  /** Practice only: bot difficulty */
  botDifficulty?: "rookie" | "gamer" | "professional";
  /** Persisted replay log (Supabase JSONB: move_log). */
  moveLog?: Array<{
    player_id: string;
    action: Record<string, unknown>;
    timestamp_ms: number;
  }>;
  /** Server-authoritative match timer start timestamp (UTC ISO). */
  matchStartTime?: string;
  /** Match countdown limit in milliseconds. */
  timeLimitMs?: number;
  /** Server-authoritative per-player clock state (used by chess). */
  player1RemainingTimeMs?: number;
  player2RemainingTimeMs?: number;
  activeTurn?: "player1" | "player2";
  turnStartedAt?: string;
}

export function generateMatchId(): string {
  return generateId();
}

export function generateFakeOpponent(baseRating: number = 1000): PlayerInfo {
  const ratingOffset = Math.floor(Math.random() * 301) - 150;
  const rating = Math.max(100, Math.min(2000, baseRating + ratingOffset));
  const winRate = 0.4 + Math.random() * 0.35;
  const matchesPlayed = 10 + Math.floor(Math.random() * 491);
  const nameIndex = Math.floor(Math.random() * OPPONENT_NAMES.length);
  return {
    username: OPPONENT_NAMES[nameIndex],
    rating,
    winRate: Math.round(winRate * 100),
    matchesPlayed,
  };
}

export function computePayout(stakeAmount: number): {
  totalPot: number;
  platformFee: number;
  winnerPayout: number;
} {
  const totalPot = stakeAmount * 2;
  const platformFee = 0;
  const winnerPayout = totalPot;
  return { totalPot, platformFee, winnerPayout };
}

export function createMatch(
  player1: PlayerInfo,
  player2: PlayerInfo,
  stakeAmount: number,
  gameType: string,
  gameDisplayName: string
): StoredMatch {
  const { totalPot, platformFee, winnerPayout } = computePayout(stakeAmount);
  const match: StoredMatch = {
    id: generateMatchId(),
    gameType,
    gameDisplayName,
    player1,
    player2,
    stakeAmount,
    platformFee,
    totalPot,
    winnerPayout,
    status: "in_progress",
    createdAt: new Date().toISOString(),
  };
  saveMatch(match);
  return match;
}

export function getMatches(): StoredMatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MATCHES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMatch(match: StoredMatch): void {
  const matches = getMatches();
  const index = matches.findIndex((m) => m.id === match.id);
  if (index >= 0) matches[index] = match;
  else matches.unshift(match);
  if (typeof window !== "undefined") {
    localStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(matches));
  }
}

export function getMatch(id: string): StoredMatch | null {
  return getMatches().find((m) => m.id === id) ?? null;
}

export function updateMatch(id: string, updates: Partial<StoredMatch>): void {
  const match = getMatch(id);
  if (match) {
    saveMatch({ ...match, ...updates });
  }
}
