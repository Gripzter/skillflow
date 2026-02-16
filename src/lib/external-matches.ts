/**
 * External match storage for Arena (CS2, Sim Racing, etc.).
 * Uses localStorage in dev mode. Matches are separate from built-in games.
 */

import { generateId } from "./wallet";
import { computePayout } from "./matchmaking";

export const EXTERNAL_MATCHES_KEY = "skillflow_external_matches";

export interface ExternalPlayerInfo {
  username: string;
  rating: number;
  steamId?: string;
}

export interface ExternalMatchResult {
  winner: "self" | "opponent" | "draw";
  score: string;
  proofUrl?: string;
}

export type ExternalMatchStatus =
  | "setup"
  | "in_progress"
  | "awaiting_results"
  | "disputed"
  | "completed";

export interface ChatMessage {
  id: string;
  sender: "player1" | "player2";
  text: string;
  timestamp: string;
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

export interface ExternalMatch {
  id: string;
  type: "external";
  game: string;
  mode: string;
  map: string;
  player1: ExternalPlayerInfo;
  player2: ExternalPlayerInfo;
  stakeAmount: number;
  platformFee: number;
  totalPot: number;
  winnerPayout: number;
  status: ExternalMatchStatus;
  player1Result: ExternalMatchResult | null;
  player2Result: ExternalMatchResult | null;
  winnerId: "player1" | "player2" | null;
  chatMessages: ChatMessage[];
  player1Ready: boolean;
  player2Ready: boolean;
  lobbyCode: string;
  createdAt: string;
  completedAt: string | null;
  connectionLog?: ConnectionSnapshot[];
  connectionWarningAcknowledged?: false | ConnectionWarningAck;
}

const STEAM_IDS = [
  "CS_Warrior_2847",
  "AimGod_92",
  "HeadHunter_77",
  "ProSniper_1337",
  "NoScope_Master",
];

export function generateExternalMatchId(): string {
  return generateId();
}

export function generateFakeSteamOpponent(username: string, rating: number): ExternalPlayerInfo {
  const steamId = STEAM_IDS[Math.floor(Math.random() * STEAM_IDS.length)];
  return {
    username,
    rating: rating + Math.floor(Math.random() * 401) - 200,
    steamId,
  };
}

export function createExternalMatch(params: {
  game: string;
  mode: string;
  map: string;
  player1: ExternalPlayerInfo;
  player2: ExternalPlayerInfo;
  stakeAmount: number;
}): ExternalMatch {
  const { totalPot, platformFee, winnerPayout } = computePayout(params.stakeAmount);
  const match: ExternalMatch = {
    id: generateExternalMatchId(),
    type: "external",
    game: params.game,
    mode: params.mode,
    map: params.map,
    player1: params.player1,
    player2: params.player2,
    stakeAmount: params.stakeAmount,
    platformFee,
    totalPot,
    winnerPayout,
    status: "setup",
    player1Result: null,
    player2Result: null,
    winnerId: null,
    chatMessages: [],
    player1Ready: false,
    player2Ready: false,
    lobbyCode: "",
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  saveExternalMatch(match);
  return match;
}

function getExternalMatchesRaw(): ExternalMatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EXTERNAL_MATCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getExternalMatches(): ExternalMatch[] {
  return getExternalMatchesRaw().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getExternalMatch(id: string): ExternalMatch | null {
  return getExternalMatchesRaw().find((m) => m.id === id) ?? null;
}

export function saveExternalMatch(match: ExternalMatch): void {
  const matches = getExternalMatchesRaw();
  const idx = matches.findIndex((m) => m.id === match.id);
  if (idx >= 0) matches[idx] = match;
  else matches.unshift(match);
  if (typeof window !== "undefined") {
    localStorage.setItem(EXTERNAL_MATCHES_KEY, JSON.stringify(matches));
  }
}

export function updateExternalMatch(
  id: string,
  updates: Partial<ExternalMatch>
): void {
  const match = getExternalMatch(id);
  if (match) {
    saveExternalMatch({ ...match, ...updates });
  }
}
