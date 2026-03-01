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

const GAME_TYPE_TO_DISPLAY_NAME: Record<string, string> = {
  "8-ball-pool": "8 Ball Pool",
  chess: "Chess",
  "connect-4": "Connect 4",
  "reaction-duel": "Reaction Duel",
};

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
}): StoredMatch {
  const status = row.status === "completed" || row.status === "draw" ? "completed" : "in_progress";
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
    isRealMultiplayer: !!row.player2_id,
    player1Id: row.player1_id ?? undefined,
    player2Id: row.player2_id ?? undefined,
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
export async function creditWallet(amount: number, description: string, txType: "match_win" | "match_refund"): Promise<number> {
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
}): Promise<StoredMatch> {
  if (params.isPractice) {
    const pm = createPracticeMatchLocal(
      params.player1,
      params.player2,
      params.gameType,
      params.gameDisplayName
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
  const supabase = createClient();
  if (!supabase) throw new Error("Not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { totalPot, platformFee, winnerPayout } = computePayout(params.stakeAmount);
  const { data, error } = await supabase
    .from("matches")
    .insert({
      game_type: params.gameType,
      player1_id: user.id,
      player1_username: params.player1.username,
      player2_username: params.player2.username,
      player1_rating: params.player1.rating,
      player2_rating: params.player2.rating,
      stake_amount: params.stakeAmount,
      platform_fee: platformFee,
      total_pot: totalPot,
      winner_payout: winnerPayout,
      status: "in_progress",
    })
    .select()
    .single();
  if (error) throw error;
  return mapDbMatchToStoredMatch(data);
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
  updates: Partial<{ status: string; winner: "player1" | "player2" | "draw" }>
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
  const row: { status?: string; result?: string; completed_at?: string } = {};
  if (updates.status) row.status = updates.status;
  if (updates.winner === "draw") row.result = "draw";
  else if (updates.winner) row.result = updates.winner === "player1" ? "player1_win" : "player2_win";
  if (updates.status === "completed") row.completed_at = new Date().toISOString();
  await supabase.from("matches").update(row).eq("id", id);
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
): Promise<void> {
  if (match.isPractice) {
    await updateMatch(match.id, {
      status: "completed",
      winner: outcome === "draw" ? undefined : outcome,
    });
    return;
  }
  if (outcome === "player2") {
    await updateMatch(match.id, { status: "completed", winner: "player2" });
    return;
  }
  if (outcome === "player1") {
    await creditWallet(
      match.winnerPayout,
      `Match win – ${match.gameDisplayName}`,
      "match_win"
    );
    await updateMatch(match.id, { status: "completed", winner: "player1" });
    return;
  }
  // draw: refund stake
  await creditWallet(
    match.stakeAmount,
    `Draw – ${match.gameDisplayName} (stake refunded)`,
    "match_refund"
  );
  await updateMatch(match.id, { status: "completed", winner: "draw" });
}

// ============ LEADERBOARD ============

export async function getLeaderboard(
  sortBy: string = "total_earnings",
  _gameType?: string
): Promise<LeaderboardPlayer[] | null> {
  if (isDevMode()) return null;
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, skill_rating, total_matches, total_wins, total_earnings")
    .order(sortBy === "skill_rating" ? "skill_rating" : "total_earnings", { ascending: false })
    .limit(50);
  if (error) return null;
  const players: LeaderboardPlayer[] = (data || []).map((p, i) => ({
    id: p.id,
    username: p.username,
    avatarGradient: "from-teal/40 to-purple/40",
    skillRating: p.skill_rating ?? 1000,
    totalMatches: p.total_matches ?? 0,
    winRate: p.total_matches ? ((p.total_wins ?? 0) / p.total_matches) * 100 : 0,
    totalEarnings: Number(p.total_earnings ?? 0),
    trend: "up",
  }));
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
      return {
        id: "dev-user-id",
        username: devUser.username || "Developer",
        email: devUser.email || "dev@skillflow.com",
        user_metadata: { username: devUser.username },
        isDevMode: true,
        emailVerified: true,
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
  if (isDevMode()) {
    localStorage.removeItem("skillflow_dev_mode");
    localStorage.removeItem("skillflow_dev_user");
    return;
  }
  const supabase = createClient();
  if (supabase) await supabase.auth.signOut();
}

// Re-export for pages that still need them
export { generateId, generateFakeOpponent, computePayout };
export type { StoredMatch, PlayerInfo };

// Practice stats (from practice-matches)
export { getPracticeMatches, getPracticeStats } from "@/lib/practice-matches";
