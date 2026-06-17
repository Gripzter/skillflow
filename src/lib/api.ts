/**
 * Central API layer: dev mode uses localStorage; real users use Supabase.
 * All pages should use these functions instead of direct localStorage or Supabase.
 */

import { createClient } from "@/lib/supabase";
import {
  getWalletBalance as getLocalBalance,
  setWalletBalance as setLocalBalance,
  getStoredTransactions,
  addStoredTransaction,
  generateId,
  type StoredTransaction,
} from "@/lib/wallet";
import {
  getMatches as getLocalMatches,
  getMatch as getLocalMatch,
  createMatch as createLocalMatch,
  updateMatch as updateLocalMatch,
  computePayout,
  generateFakeOpponent,
  type StoredMatch,
  type PlayerInfo,
} from "@/lib/matchmaking";
import {
  getPracticeMatch,
  getPracticeMatches,
  createPracticeMatch as createPracticeMatchLocal,
  updatePracticeMatch as updatePracticeMatchLocal,
  getPracticeStats,
} from "@/lib/practice-matches";
import { type LeaderboardPlayer } from "@/lib/leaderboard-data";
import { notifyChallengeProgressFromClient } from "@/lib/challengeProgress";
import { finishMatch } from "@/lib/matchActions";
import { signOutAndRedirect } from "@/lib/client-session";

const GAME_TYPE_TO_DISPLAY_NAME: Record<string, string> = {
  "8-ball-pool": "8 Ball Pool",
  chess: "Chess",
  "connect-4": "Connect 4",
  "reaction-duel": "Reaction Duel",
  "memory-match": "Memory Match",
  checkers: "Checkers",
  blockade: "Blockade",
  "spelling-bee": "Spelling Bee",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_PLAYER_UUID = "00000000-0000-0000-0000-000000000001";

function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value);
}

function isDevMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("skillflow_dev_mode") === "true";
}

function mapDbMatchToStoredMatch(row: {
  id: string;
  game_type: string;
  player1_username: string | null;
  player2_username: string | null;
  player1_rating: number | null;
  player2_rating: number | null;
  stake_amount: number;
  platform_fee: number;
  total_pot: number;
  winner_payout: number;
  status: string;
  result: string | null;
  created_at: string;
  player2_id?: string | null;
  player1_id?: string | null;
  is_bot?: boolean | null;
  bot_difficulty?: string | null;
  move_log?: Array<{
    player_id: string;
    action: Record<string, unknown>;
    timestamp_ms: number;
  }> | null;
  match_start_time?: string | null;
  time_limit_ms?: number | null;
  player1_remaining_time_ms?: number | null;
  player2_remaining_time_ms?: number | null;
  active_turn?: string | null;
  turn_started_at?: string | null;
  qr_match_id?: string | null;
  player_b_is_bot?: boolean | null;
}): StoredMatch {
  const status =
    row.status === "completed" || row.status === "draw"
      ? "completed"
      : row.status === "waiting" || row.status === "matched"
        ? "in_progress"
        : "in_progress";
  let winner: "player1" | "player2" | undefined;
  if (row.result === "player1_win") winner = "player1";
  else if (row.result === "player2_win") winner = "player2";
  return {
    id: row.id,
    gameType: row.game_type,
    gameDisplayName: GAME_TYPE_TO_DISPLAY_NAME[row.game_type] || row.game_type,
    player1: {
      username: row.player1_username || "Player 1",
      rating: row.player1_rating ?? 1000,
      winRate: 50,
      matchesPlayed: 0,
    },
    player2: {
      username: row.player2_username || "Opponent",
      rating: row.player2_rating ?? 1000,
      winRate: 50,
      matchesPlayed: 0,
    },
    stakeAmount: Number(row.stake_amount),
    platformFee: Number(row.platform_fee),
    totalPot: Number(row.total_pot),
    winnerPayout: Number(row.winner_payout),
    status,
    winner,
    createdAt: row.created_at,
    isRealMultiplayer:
      !!row.qr_match_id || (!!row.player2_id && !row.is_bot && !row.player_b_is_bot),
    isQrMatch: !!row.qr_match_id,
    player1Id: row.player1_id ?? undefined,
    player2Id: row.player2_id ?? undefined,
    isBot: !!row.is_bot || !!row.player_b_is_bot,
    botDifficulty:
      row.bot_difficulty === "rookie" || row.bot_difficulty === "gamer" || row.bot_difficulty === "professional"
        ? row.bot_difficulty
        : undefined,
    moveLog: Array.isArray(row.move_log) ? row.move_log : [],
    matchStartTime: row.match_start_time ?? undefined,
    timeLimitMs: typeof row.time_limit_ms === "number" ? row.time_limit_ms : undefined,
    player1RemainingTimeMs:
      typeof row.player1_remaining_time_ms === "number" ? row.player1_remaining_time_ms : undefined,
    player2RemainingTimeMs:
      typeof row.player2_remaining_time_ms === "number" ? row.player2_remaining_time_ms : undefined,
    activeTurn: row.active_turn === "player1" || row.active_turn === "player2" ? row.active_turn : undefined,
    turnStartedAt: row.turn_started_at ?? undefined,
  };
}

// ============ PROFILE ============

export async function getProfile(userId: string | undefined): Promise<{
  id: string;
  username: string;
  skill_rating: number;
  total_matches: number;
  total_wins: number;
  total_losses: number;
  total_earnings: number;
  [key: string]: unknown;
} | null> {
  if (isDevMode()) {
    try {
      const devUser = JSON.parse(localStorage.getItem("skillflow_dev_user") || "{}");
      const matches = getLocalMatches();
      return {
        id: "dev-user-id",
        username: devUser.username || "Developer",
        skill_rating: 1000,
        total_matches: matches.length,
        total_wins: matches.filter((m) => m.winner === "player1").length,
        total_losses: matches.filter((m) => m.status === "completed" && m.winner === "player2").length,
        total_earnings: 0,
      };
    } catch {
      return null;
    }
  }
  if (!userId) return null;
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data;
}

export async function getMyProfile() {
  if (isDevMode()) return getProfile(undefined);
  const supabase = createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getProfile(user.id);
}

// ============ WALLET ============

export async function getWalletBalance(): Promise<number> {
  if (isDevMode()) return getLocalBalance();
  const supabase = createClient();
  if (!supabase) return 0;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data, error } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  if (error) return 0;
  return Number(data?.balance ?? 0);
}

export async function setWalletBalance(value: number): Promise<void> {
  if (isDevMode()) {
    setLocalBalance(value);
    return;
  }
  const supabase = createClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("wallets")
    .update({ balance: value, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
}

/** Credit wallet (e.g. match win or refund). Returns new balance. */
export async function creditWallet(
  amount: number,
  description: string,
  txType: "match_win" | "match_refund" | "match_entry"
): Promise<number> {
  if (isDevMode()) {
    const balance = getLocalBalance();
    const newBalance = balance + amount;
    setLocalBalance(newBalance);
    addStoredTransaction({
      id: generateId(),
      type: txType,
      amount,
      balance_after: newBalance,
      description,
      created_at: new Date().toISOString(),
    });
    return newBalance;
  }
  const supabase = createClient();
  if (!supabase) return 0;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  if (!wallet) return 0;
  const newBalance = Number(wallet.balance) + amount;
  await supabase
    .from("wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  await supabase.from("transactions").insert({
    user_id: user.id,
    type: txType,
    amount,
    balance_after: newBalance,
    description,
    status: "completed",
  });
  return newBalance;
}

/** Debit wallet (e.g. match entry). Returns new balance or throws if insufficient. */
export async function debitWallet(amount: number, description: string): Promise<number> {
  if (isDevMode()) {
    const balance = getLocalBalance();
    if (amount > balance) throw new Error("Insufficient balance");
    const newBalance = balance - amount;
    setLocalBalance(newBalance);
    addStoredTransaction({
      id: generateId(),
      type: "match_entry",
      amount: -amount,
      balance_after: newBalance,
      description,
      created_at: new Date().toISOString(),
    });
    return newBalance;
  }
  const supabase = createClient();
  if (!supabase) throw new Error("Not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  if (!wallet || Number(wallet.balance) < amount) throw new Error("Insufficient balance");
  const newBalance = Number(wallet.balance) - amount;
  await supabase
    .from("wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "match_entry",
    amount: -amount,
    balance_after: newBalance,
    description,
    status: "completed",
  });
  return newBalance;
}

export async function deposit(amount: number): Promise<number> {
  if (isDevMode()) {
    const balance = getLocalBalance();
    const newBalance = balance + amount;
    setLocalBalance(newBalance);
    addStoredTransaction({
      id: generateId(),
      type: "deposit",
      amount,
      balance_after: newBalance,
      description: `Deposited $${amount.toFixed(2)}`,
      created_at: new Date().toISOString(),
    });
    return newBalance;
  }
  const supabase = createClient();
  if (!supabase) throw new Error("Not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: wallet } = await supabase.from("wallets").select("balance, total_deposited").eq("user_id", user.id).single();
  if (!wallet) throw new Error("Wallet not found");
  const newBalance = Number(wallet.balance) + amount;
  await supabase
    .from("wallets")
    .update({
      balance: newBalance,
      total_deposited: Number(wallet.total_deposited) + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "deposit",
    amount,
    balance_after: newBalance,
    description: `Deposited $${amount.toFixed(2)}`,
    status: "completed",
  });
  return newBalance;
}

export async function withdraw(amount: number): Promise<number> {
  if (isDevMode()) {
    const balance = getLocalBalance();
    if (amount > balance) throw new Error("Insufficient balance");
    const newBalance = balance - amount;
    setLocalBalance(newBalance);
    addStoredTransaction({
      id: generateId(),
      type: "withdrawal",
      amount: -amount,
      balance_after: newBalance,
      description: `Withdrew $${amount.toFixed(2)}`,
      created_at: new Date().toISOString(),
    });
    return newBalance;
  }
  const supabase = createClient();
  if (!supabase) throw new Error("Not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: wallet } = await supabase.from("wallets").select("balance, total_withdrawn").eq("user_id", user.id).single();
  if (!wallet) throw new Error("Wallet not found");
  if (amount > Number(wallet.balance)) throw new Error("Insufficient balance");
  const newBalance = Number(wallet.balance) - amount;
  await supabase
    .from("wallets")
    .update({
      balance: newBalance,
      total_withdrawn: Number(wallet.total_withdrawn) + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "withdrawal",
    amount: -amount,
    balance_after: newBalance,
    description: `Withdrew $${amount.toFixed(2)}`,
    status: "completed",
  });
  return newBalance;
}

// ============ TRANSACTIONS ============

export async function getTransactions(): Promise<StoredTransaction[]> {
  if (isDevMode()) return getStoredTransactions();
  const supabase = createClient();
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, amount, balance_after, description, created_at, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []).map((r) => ({
    id: r.id,
    type: r.type as StoredTransaction["type"],
    amount: Number(r.amount),
    balance_after: Number(r.balance_after),
    description: r.description ?? undefined,
    created_at: r.created_at,
    status: (r as { status?: string }).status ?? undefined,
  }));
}

// ============ MATCHES ============

export async function createMatch(params: {
  gameType: string;
  gameDisplayName: string;
  stakeAmount: number;
  player1: PlayerInfo;
  player2: PlayerInfo;
  isPractice?: boolean;
  botDifficulty?: "rookie" | "gamer" | "professional";
}): Promise<StoredMatch> {
  if (params.isPractice) {
    const pm = createPracticeMatchLocal(
      params.player1,
      params.player2,
      params.gameType,
      params.gameDisplayName,
      params.botDifficulty ?? "gamer"
    );
    return { ...pm, isPractice: true } as StoredMatch;
  }
  if (isDevMode()) {
    return createLocalMatch(
      params.player1,
      params.player2,
      params.stakeAmount,
      params.gameType,
      params.gameDisplayName
    );
  }
  throw new Error("createMatch is practice-only; use startMatch() for real matches");
}

export async function getMatch(id: string): Promise<StoredMatch | null> {
  const practice = getPracticeMatch(id);
  if (practice) return { ...practice, isPractice: true } as StoredMatch;
  if (isDevMode()) return getLocalMatch(id);
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("matches").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapDbMatchToStoredMatch(data);
}

export async function getQrGuestMatch(
  matchId: string,
  anonymousSessionToken: string
): Promise<StoredMatch | null> {
  const { fetchQrGuestMatch } = await import("@/lib/qr-match");
  const result = await fetchQrGuestMatch(matchId, anonymousSessionToken);
  if (!result.found || !result.match) return null;
  return mapDbMatchToStoredMatch(result.match);
}

export async function getMatches(): Promise<StoredMatch[]> {
  if (isDevMode()) return getLocalMatches();
  const supabase = createClient();
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []).map(mapDbMatchToStoredMatch);
}

export async function updateMatch(
  id: string,
  updates: Partial<{
    status: string;
    winner: "player1" | "player2" | "draw";
    winnerId: string | null;
    loserId: string | null;
    moveLog: Array<{ player_id: string; action: Record<string, unknown>; timestamp_ms: number }>;
    matchStartTime: string;
    timeLimitMs: number;
    player1RemainingTimeMs: number;
    player2RemainingTimeMs: number;
    activeTurn: "player1" | "player2";
    turnStartedAt: string;
  }>
): Promise<void> {
  const practice = getPracticeMatch(id);
  if (practice) {
    updatePracticeMatchLocal(id, {
      status: updates.status as "in_progress" | "completed",
      winner: updates.winner === "draw" ? undefined : (updates.winner as "player1" | "player2"),
    });
    return;
  }
  if (isDevMode()) {
    const forLocal =
      updates.winner === "draw"
        ? { status: updates.status }
        : (updates as Partial<StoredMatch>);
    updateLocalMatch(id, forLocal);
    return;
  }
  const supabase = createClient();
  if (!supabase) return;
  const row: {
    status?: string;
    result?: string;
    winner_id?: string | null;
    loser_id?: string | null;
    completed_at?: string;
    move_log?: Array<{ player_id: string; action: Record<string, unknown>; timestamp_ms: number }>;
    match_start_time?: string;
    time_limit_ms?: number;
    player1_remaining_time_ms?: number;
    player2_remaining_time_ms?: number;
    active_turn?: "player1" | "player2";
    turn_started_at?: string;
  } = {};
  if (updates.status) row.status = updates.status;
  if (updates.winner === "draw") row.result = "draw";
  else if (updates.winner) row.result = updates.winner === "player1" ? "player1_win" : "player2_win";
  if (Object.prototype.hasOwnProperty.call(updates, "winnerId")) row.winner_id = updates.winnerId ?? null;
  if (Object.prototype.hasOwnProperty.call(updates, "loserId")) row.loser_id = updates.loserId ?? null;
  if (updates.status === "completed") row.completed_at = new Date().toISOString();
  if (updates.moveLog) row.move_log = updates.moveLog;
  if (updates.matchStartTime) row.match_start_time = updates.matchStartTime;
  if (typeof updates.timeLimitMs === "number") row.time_limit_ms = updates.timeLimitMs;
  if (typeof updates.player1RemainingTimeMs === "number") row.player1_remaining_time_ms = updates.player1RemainingTimeMs;
  if (typeof updates.player2RemainingTimeMs === "number") row.player2_remaining_time_ms = updates.player2RemainingTimeMs;
  if (updates.activeTurn) row.active_turn = updates.activeTurn;
  if (updates.turnStartedAt) row.turn_started_at = updates.turnStartedAt;
  const { error } = await supabase.from("matches").update(row).eq("id", id);
  if (error) throw error;
}

export async function completeMatch(matchId: string, winner: "player1" | "player2"): Promise<void> {
  await updateMatch(matchId, { status: "completed", winner });
}

/**
 * Complete a match and settle wallet (credit winner or refund draw).
 * Practice matches: no wallet changes, only update practice storage.
 */
export async function completeMatchAndSettle(
  match: StoredMatch,
  outcome: "player1" | "player2" | "draw"
): Promise<{
  status: "local" | "settled" | "already_settled";
  callerWon: boolean;
  payout: number;
  callerBalance: number | null;
}> {
  const currentUser = await getCurrentUser();
  const currentUserId = currentUser?.id;

  // eslint-disable-next-line no-console
  console.log("[MATCH_END_START]", {
    timestamp: new Date().toISOString(),
    matchId: match?.id ?? "UNKNOWN",
    rawMatchData: JSON.stringify({
      id: match?.id,
      player1_id: match?.player1Id,
      player2_id: match?.player2Id,
      is_bot: match?.isBot,
      game_type: match?.gameType,
      bet_amount: match?.stakeAmount,
      status: match?.status,
      result: match?.winner === "player1" ? "player1_win" : match?.winner === "player2" ? "player2_win" : null,
      winner_id: null,
      loser_id: null,
    }),
    inputs: JSON.stringify({
      outcome,
      currentUserId,
      isPractice: match?.isPractice,
      isRealMultiplayer: match?.isRealMultiplayer,
    }),
  });

  const isWinner =
    outcome !== "draw" &&
    !!currentUserId &&
    ((outcome === "player1" && match.player1Id === currentUserId) ||
      (outcome === "player2" && match.player2Id === currentUserId));
  const didDraw = outcome === "draw";
  const didLoss = !isWinner && !didDraw;
  let result: "player1_win" | "player2_win" | "draw" = "draw";
  let winnerId: string | null = null;
  let loserId: string | null = null;

  if (outcome !== "draw") {
    if (match.isBot) {
      const possibleHumanIds = [match.player1Id, match.player2Id].filter(
        (id): id is string => isUuid(id) && id !== BOT_PLAYER_UUID
      );
      const humanPlayerId =
        possibleHumanIds.length === 1
          ? possibleHumanIds[0]
          : currentUserId && possibleHumanIds.includes(currentUserId)
            ? currentUserId
            : possibleHumanIds[0];

      if (!humanPlayerId) {
        throw new Error("No human player in match — cannot finalize");
      }

      const humanIsPlayer1 = match.player1Id === humanPlayerId;
      const humanIsPlayer2 = match.player2Id === humanPlayerId;
      if (!humanIsPlayer1 && !humanIsPlayer2) {
        throw new Error("Human player role is invalid — cannot finalize");
      }

      const humanWon = (outcome === "player1" && humanIsPlayer1) || (outcome === "player2" && humanIsPlayer2);

      if (humanWon) {
        if (humanIsPlayer1) {
          result = "player1_win";
          winnerId = match.player1Id ?? null;
          loserId = match.player2Id ?? null;
        } else {
          result = "player2_win";
          winnerId = match.player2Id ?? null;
          loserId = match.player1Id ?? null;
        }
      } else if (humanIsPlayer1) {
        result = "player2_win";
        winnerId = match.player2Id ?? null;
        loserId = match.player1Id ?? null;
      } else {
        result = "player1_win";
        winnerId = match.player1Id ?? null;
        loserId = match.player2Id ?? null;
      }
    } else {
      result = outcome === "player1" ? "player1_win" : "player2_win";
      winnerId = result === "player1_win" ? (match.player1Id ?? null) : (match.player2Id ?? null);
      loserId = result === "player1_win" ? (match.player2Id ?? null) : (match.player1Id ?? null);
    }
  }

  async function persistFinalizedMatch() {
    if (match.isPractice || isDevMode()) {
      await updateMatch(match.id, {
        status: "completed",
        winner: result === "draw" ? "draw" : result === "player1_win" ? "player1" : "player2",
        winnerId,
        loserId,
      });
      // eslint-disable-next-line no-console
      console.log("[MATCH_FINALIZED]", {
        matchId: match.id,
        result,
        winnerId,
        loserId,
        isBot: match.isBot,
      });
      return true;
    }

    const supabase = createClient();
    if (!supabase) {
      // eslint-disable-next-line no-console
      console.error("[MATCH_FINALIZE_FAILED]", { matchId: match.id, error: "Supabase not configured" });
      return false;
    }

    const { error: updateError } = await supabase
      .from("matches")
      .update({
        result,
        winner_id: winnerId,
        loser_id: loserId,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    if (updateError) {
      // eslint-disable-next-line no-console
      console.error("[MATCH_FINALIZE_FAILED]", { matchId: match.id, error: updateError });
      return false;
    }

    // eslint-disable-next-line no-console
    console.log("[MATCH_FINALIZED]", {
      matchId: match.id,
      result,
      winnerId,
      loserId,
      isBot: match.isBot,
    });
    return true;
  }

  async function notifyChallengesForMatchResult() {
    const isBotMatch = match.isBot === true;
    const targets: Array<{ userId: string; won: boolean }> = [];

    if (isBotMatch) {
      const humanPlayerId = match.player1Id ?? match.player2Id;
      if (!isUuid(humanPlayerId)) {
        // eslint-disable-next-line no-console
        console.error("[Challenges] Bot match missing human player ID", { matchId: match.id, result });
        return;
      }

      const humanWon =
        (match.player1Id === humanPlayerId && result === "player1_win") ||
        (match.player2Id === humanPlayerId && result === "player2_win");

      targets.push({ userId: humanPlayerId, won: humanWon });
    } else {
      if (isUuid(match.player1Id)) {
        targets.push({ userId: match.player1Id, won: result === "player1_win" });
      }
      if (isUuid(match.player2Id)) {
        targets.push({ userId: match.player2Id, won: result === "player2_win" });
      }
    }

    for (const target of targets) {
      try {
        await notifyChallengeProgressFromClient(target.userId, match.gameType, target.won);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[Challenges] Unexpected challenge progress error", {
          matchId: match.id,
          userId: target.userId,
          error,
        });
      }
    }
  }

  if (match.isPractice) {
    const persisted = await persistFinalizedMatch();
    if (!persisted) {
      return { status: "local", callerWon: isWinner, payout: 0, callerBalance: null };
    }
    await notifyChallengesForMatchResult();
    return { status: "local", callerWon: isWinner, payout: 0, callerBalance: null };
  }

  async function updateGameStatsForCurrentUser() {
    if (isDevMode()) return;
    if (!currentUserId) return;
    const supabase = createClient();
    if (!supabase) return;

    const { data: existing } = await supabase
      .from("game_stats")
      .select("matches_played, wins, losses, draws, total_earnings")
      .eq("user_id", currentUserId)
      .eq("game_type", match.gameType)
      .maybeSingle();

    const matchesPlayed = Number(existing?.matches_played ?? 0) + 1;
    const wins = Number(existing?.wins ?? 0) + (isWinner ? 1 : 0);
    const losses = Number(existing?.losses ?? 0) + (didLoss ? 1 : 0);
    const draws = Number(existing?.draws ?? 0) + (didDraw ? 1 : 0);
    const totalEarnings =
      Number(existing?.total_earnings ?? 0) + (isWinner ? Number(match.winnerPayout) : 0);

    await supabase.from("game_stats").upsert(
      {
        user_id: currentUserId,
        game_type: match.gameType,
        matches_played: matchesPlayed,
        wins,
        losses,
        draws,
        total_earnings: totalEarnings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,game_type" }
    );
  }

  if (outcome === "player1" || outcome === "player2") {
    if (isDevMode()) {
      let callerBalance: number | null = null;
      let payout = 0;
      if (isWinner) {
        callerBalance = await creditWallet(
          match.winnerPayout,
          `Match win – ${match.gameDisplayName}`,
          "match_win"
        );
        payout = match.winnerPayout;
      }
      const persisted = await persistFinalizedMatch();
      if (!persisted) {
        return { status: "local", callerWon: isWinner, payout, callerBalance };
      }
      await updateGameStatsForCurrentUser();
      await notifyChallengesForMatchResult();
      return { status: "local", callerWon: isWinner, payout, callerBalance };
    }

    const settlementWinnerId =
      match.isBot && winnerId === BOT_PLAYER_UUID ? null : isUuid(winnerId) ? winnerId : null;

    const settlement = await finishMatch({
      matchId: match.id,
      winnerId: settlementWinnerId,
      gameResult: { outcome, gameType: match.gameType },
    });
    await updateGameStatsForCurrentUser();
    await notifyChallengesForMatchResult();
    return {
      status: settlement.status,
      callerWon: settlement.caller_won,
      payout: settlement.payout,
      callerBalance: settlement.caller_balance,
    };
  }

  if (isDevMode()) {
    const callerBalance = await creditWallet(
      match.stakeAmount,
      `Draw – ${match.gameDisplayName} (stake refunded)`,
      "match_refund"
    );
    const persisted = await persistFinalizedMatch();
    if (!persisted) {
      return { status: "local", callerWon: false, payout: 0, callerBalance };
    }
    await updateGameStatsForCurrentUser();
    await notifyChallengesForMatchResult();
    return { status: "local", callerWon: false, payout: 0, callerBalance };
  }

  const settlement = await finishMatch({
    matchId: match.id,
    winnerId: null,
    gameResult: { outcome: "draw", gameType: match.gameType },
  });
  await updateGameStatsForCurrentUser();
  await notifyChallengesForMatchResult();
  return {
    status: settlement.status,
    callerWon: false,
    payout: settlement.payout,
    callerBalance: settlement.caller_balance,
  };
}

// ============ LEADERBOARD ============

export async function getLeaderboard(
  sortBy: string = "rating",
  _gameType?: string
): Promise<LeaderboardPlayer[] | null> {
  if (isDevMode()) return null;
  const supabase = createClient();
  if (!supabase) return null;

  if (sortBy === "rating" || sortBy === "skill_rating") {
    const { data, error } = await supabase
      .from("player_ratings")
      .select("user_id, rating, matches_played")
      .eq("game_type", "overall")
      .order("rating", { ascending: false })
      .limit(50);
    if (!error && data && data.length > 0) {
      const userIds = data.map((row) => row.user_id as string);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, total_matches, total_wins, total_earnings")
        .in("id", userIds);
      const profileById = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]));

      return data.map((row) => {
        const profile = profileById.get(row.user_id as string);
        const totalMatches = Number(row.matches_played ?? profile?.total_matches ?? 0);
        const wins = Number(profile?.total_wins ?? 0);
        return {
          id: row.user_id as string,
          username: (profile?.username as string | null) ?? "Player",
          avatarGradient: "from-teal/40 to-purple/40",
          avatarUrl: (profile?.avatar_url as string | null) ?? null,
          skillRating: Math.round(Number(row.rating ?? 1000)),
          totalMatches,
          winRate: totalMatches ? Math.round((wins / totalMatches) * 1000) / 10 : 0,
          totalEarnings: Number(profile?.total_earnings ?? 0),
          trend: "up",
          wins,
          losses: Math.max(0, totalMatches - wins),
        };
      });
    }
  }

  const orderColumn =
    sortBy === "matches" ? "total_matches" : sortBy === "winRate" ? "total_wins" : "skillflow_score";
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, skillflow_score, total_matches, total_wins, total_earnings")
    .order(orderColumn, { ascending: false })
    .limit(50);
  if (error) return null;
  const players: LeaderboardPlayer[] = (data || []).map((p) => {
    const totalMatches = p.total_matches ?? 0;
    const wins = p.total_wins ?? 0;
    const losses = Math.max(0, totalMatches - wins);
    return {
      id: p.id,
      username: p.username,
      avatarGradient: "from-teal/40 to-purple/40",
      avatarUrl: (p.avatar_url as string | null) ?? null,
      skillRating: Math.round(Number(p.skillflow_score ?? 1000)),
      totalMatches,
      winRate: totalMatches ? Math.round((wins / totalMatches) * 1000) / 10 : 0,
      totalEarnings: Number(p.total_earnings ?? 0),
      trend: "up",
      wins,
      losses,
    };
  });
  return players;
}

// ============ AUTH / USER ============

export async function getCurrentUser(): Promise<{
  id: string;
  username: string;
  email?: string;
  user_metadata?: { username?: string };
  isDevMode: boolean;
  emailVerified: boolean;
} | null> {
  if (isDevMode()) {
    try {
      const devUser = JSON.parse(localStorage.getItem("skillflow_dev_user") || "{}");
      const supabase = createClient();
      let resolvedId = "dev-user-id";
      let emailVerified = true;
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
          resolvedId = user.id;
          emailVerified = !!user.email_confirmed_at;
        }
      }
      return {
        id: resolvedId,
        username: devUser.username || "Developer",
        email: devUser.email || "dev@skillflow.com",
        user_metadata: { username: devUser.username },
        isDevMode: true,
        emailVerified,
      };
    } catch {
      return null;
    }
  }
  const supabase = createClient();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const profile = await getProfile(user.id);
  return {
    ...user,
    username: profile?.username ?? user.user_metadata?.username ?? "Player",
    user_metadata: { ...user.user_metadata, username: profile?.username ?? user.user_metadata?.username },
    isDevMode: false,
    emailVerified: !!user.email_confirmed_at,
  };
}

export async function logout(): Promise<void> {
  await signOutAndRedirect("/login");
}

// Re-export for pages that still need them
export { generateId, generateFakeOpponent, computePayout };
export type { StoredMatch, PlayerInfo };

// Practice stats (from practice-matches)
export { getPracticeMatches, getPracticeStats } from "@/lib/practice-matches";

// ============ REPORTS ============

export async function submitReport(params: {
  reporterUserId: string;
  reporterUsername?: string;
  reportedUserId: string | null;
  reportedUsername?: string;
  matchId: string;
  gameType: string;
  reportReason: string;
  reportComment: string;
}): Promise<void> {
  const supabase = createClient();
  if (!supabase) {
    console.error("[submitReport] Supabase client is null — check env vars");
    return;
  }

  // Use the live session UID, not the locally-stored userId state.
  // In dev mode getCurrentUser() returns "dev-user-id" which fails the FK
  // constraint on reporter_user_id even with RLS disabled.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[submitReport] No authenticated Supabase session — skipping insert (dev/practice mode)");
    return;
  }

  // Postgres uuid columns reject non-UUID strings with error 22P02.
  // Practice/dev match IDs can be "id-<timestamp>-<rand>" when crypto.randomUUID
  // is unavailable, so coerce to null rather than letting the insert blow up.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const safeMatchId = params.matchId && UUID_RE.test(params.matchId) ? params.matchId : null;
  const safeReportedId = params.reportedUserId && UUID_RE.test(params.reportedUserId)
    ? params.reportedUserId
    : null;

  const payload = {
    reporter_user_id: user.id,          // always the real auth UID
    reporter_username: params.reporterUsername || null,
    reported_user_id: safeReportedId,
    reported_username: params.reportedUsername || null,
    match_id: safeMatchId,
    game_type: params.gameType || null,
    report_reason: params.reportReason,
    report_comment: params.reportComment || null,
    status: "new",
  };

  const { error } = await supabase.from("reports").insert(payload);
  if (error) throw error;
}
