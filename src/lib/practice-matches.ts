/**
 * Practice match storage (localStorage). Separate from real matches.
 */

import { generateId } from "./wallet";
import type { PlayerInfo } from "./matchmaking";

export const PRACTICE_MATCHES_STORAGE_KEY = "skillflow_practice_matches";

export interface PracticeMatch {
  id: string;
  type: "practice";
  gameType: string;
  gameDisplayName: string;
  player1: PlayerInfo;
  player2: PlayerInfo;
  stakeAmount: 0;
  platformFee: 0;
  totalPot: 0;
  winnerPayout: 0;
  status: "in_progress" | "completed";
  winner?: "player1" | "player2";
  createdAt: string;
  durationMs?: number;
}

export function getPracticeMatches(): PracticeMatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRACTICE_MATCHES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getPracticeMatch(id: string): PracticeMatch | null {
  return getPracticeMatches().find((m) => m.id === id) ?? null;
}

function savePracticeMatches(matches: PracticeMatch[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRACTICE_MATCHES_STORAGE_KEY, JSON.stringify(matches));
}

export function savePracticeMatch(match: PracticeMatch): void {
  const matches = getPracticeMatches();
  const index = matches.findIndex((m) => m.id === match.id);
  if (index >= 0) matches[index] = match;
  else matches.unshift(match);
  savePracticeMatches(matches);
}

export function createPracticeMatch(
  player1: PlayerInfo,
  player2: PlayerInfo,
  gameType: string,
  gameDisplayName: string
): PracticeMatch {
  const match: PracticeMatch = {
    id: generateId(),
    type: "practice",
    gameType,
    gameDisplayName,
    player1,
    player2,
    stakeAmount: 0,
    platformFee: 0,
    totalPot: 0,
    winnerPayout: 0,
    status: "in_progress",
    createdAt: new Date().toISOString(),
  };
  savePracticeMatch(match);
  return match;
}

export function updatePracticeMatch(
  id: string,
  updates: Partial<Pick<PracticeMatch, "status" | "winner" | "durationMs">>
): void {
  const match = getPracticeMatch(id);
  if (match) savePracticeMatch({ ...match, ...updates });
}

export interface PracticeStats {
  practiceMatchesPlayed: number;
  practiceWins: number;
  practiceWinRate: number;
}

export function getPracticeStats(username: string): PracticeStats {
  const matches = getPracticeMatches().filter((m) => m.status === "completed");
  const asPlayer1 = matches.filter((m) => m.player1.username === username);
  const wins = asPlayer1.filter((m) => m.winner === "player1").length;
  const played = asPlayer1.length;
  return {
    practiceMatchesPlayed: played,
    practiceWins: wins,
    practiceWinRate: played ? Math.round((wins / played) * 1000) / 10 : 0,
  };
}
