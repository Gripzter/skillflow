import { createClient } from "@/lib/supabase";

export const QR_ANON_TOKEN_KEY = "skillflow_qr_anon_token";
export const QR_ANON_GUEST_KEY = "skillflow_qr_anon_guest_id";

export const QR_GAMES = [
  { slug: "chess", name: "Chess", icon: "♟️" },
  { slug: "connect-4", name: "Connect 4", icon: "🔴" },
  { slug: "checkers", name: "Checkers", icon: "⬛" },
  { slug: "reaction-duel", name: "Reaction Duel", icon: "⚡" },
  { slug: "memory-match", name: "Memory Match", icon: "🧠" },
  { slug: "spelling-bee", name: "Spelling Bee", icon: "🐝" },
] as const;

export const QR_STAKE_PRESETS = [10, 25, 50, 100] as const;
export const QR_MIN_STAKE = 5;
export const QR_MAX_STAKE = 1000;

export type QRMatchPublic = {
  found: boolean;
  id?: string;
  game?: string;
  stake_sk?: number | null;
  status?: string;
  stake_status?: string;
  expires_at?: string;
  host_username?: string;
  host_avatar_url?: string | null;
  short_code?: string;
  match_id?: string | null;
};

export type CreateQRMatchResult = {
  id: string;
  qr_token: string;
  short_code: string;
  game: string;
  expires_at: string;
};

export type AcceptQRMatchResult = {
  qr_match_id: string;
  game: string;
  host_user_id: string;
  opponent_is_anonymous: boolean;
  anonymous_guest_id?: string;
  status: string;
};

export type QRNegotiationState = {
  found: boolean;
  role?: "host" | "opponent";
  id?: string;
  game?: string;
  status?: string;
  stake_status?: string;
  stake_sk?: number | null;
  proposed_stake_sk?: number | null;
  match_id?: string | null;
  opponent_is_anonymous?: boolean;
  host_username?: string;
  host_avatar_url?: string | null;
  opponent_username?: string;
  opponent_avatar_url?: string | null;
};

export function getNegotiateUrl(qrMatchId: string, guest = false): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "https://skillflow.gg";
  return `${base}/qr/${qrMatchId}/negotiate${guest ? "?guest=1" : ""}`;
}

export function getJoinUrl(qrToken: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "https://skillflow.gg";
  return `${base}/join/${qrToken}`;
}

export function getOrCreateAnonymousToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem(QR_ANON_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(QR_ANON_TOKEN_KEY, token);
    document.cookie = `${QR_ANON_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`;
  }
  return token;
}

export function storeAnonymousGuestId(guestId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(QR_ANON_GUEST_KEY, guestId);
}

export function getAnonymousGuestId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(QR_ANON_GUEST_KEY);
}

export function getAnonymousTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${QR_ANON_TOKEN_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function fetchQRMatchByToken(token: string): Promise<QRMatchPublic> {
  const supabase = createClient();
  if (!supabase) return { found: false };
  const { data, error } = await supabase.rpc("get_qr_match_by_token", { p_token: token });
  if (error) throw new Error(error.message);
  return data as QRMatchPublic;
}

export async function createQRMatch(game: string): Promise<CreateQRMatchResult> {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("create_qr_match", { p_game: game });
  if (error) throw new Error(error.message);
  return data as CreateQRMatchResult;
}

export async function cancelQRMatch(id: string): Promise<void> {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("cancel_qr_match", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function expireQRMatch(id: string): Promise<void> {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("expire_qr_match", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function acceptQRMatch(
  token: string,
  options: { opponentUserId?: string | null; anonymousSessionToken?: string | null }
): Promise<AcceptQRMatchResult> {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("accept_qr_match", {
    p_token: token,
    p_anonymous_session_token: options.anonymousSessionToken ?? null,
    p_opponent_user_id: options.opponentUserId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as AcceptQRMatchResult;
}

export async function proposeStake(qrMatchId: string, amountSk: number) {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("propose_stake", {
    p_qr_match_id: qrMatchId,
    p_amount_sk: amountSk,
  });
  if (error) throw new Error(error.message);
  return data as { qr_match_id: string; proposed_stake_sk: number; stake_status: string };
}

export async function respondToStake(
  qrMatchId: string,
  accept: boolean,
  anonymousSessionToken?: string | null
) {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("respond_to_stake", {
    p_qr_match_id: qrMatchId,
    p_accept: accept,
    p_anonymous_session_token: anonymousSessionToken ?? null,
  });
  if (error) throw new Error(error.message);
  return data as {
    stake_status: string;
    accepted: boolean;
    match_id?: string;
    stake_sk?: number;
  };
}

export async function fetchNegotiationState(
  qrMatchId: string,
  anonymousSessionToken?: string | null
): Promise<QRNegotiationState> {
  const supabase = createClient();
  if (!supabase) return { found: false };
  const { data, error } = await supabase.rpc("get_qr_negotiation_state", {
    p_qr_match_id: qrMatchId,
    p_anonymous_session_token: anonymousSessionToken ?? null,
  });
  if (error) throw new Error(error.message);
  return data as QRNegotiationState;
}

export async function claimAnonymousPayout(token: string): Promise<{ amount_sk: number; balance_sp: number }> {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("claim_anonymous_payout", {
    p_anonymous_session_token: token,
  });
  if (error) throw new Error(error.message);
  return data as { amount_sk: number; balance_sp: number };
}

export async function getAnonymousPendingPayout(token: string) {
  const supabase = createClient();
  if (!supabase) return { found: false };
  const { data, error } = await supabase.rpc("get_anonymous_pending_payout", {
    p_anonymous_session_token: token,
  });
  if (error) return { found: false };
  return data as { found: boolean; amount_sk?: number; expires_at?: string; qr_match_id?: string };
}

export function isQRSupportedGame(slug: string): boolean {
  return QR_GAMES.some((g) => g.slug === slug);
}

export async function lookupQRMatchByShortCode(
  shortCode: string
): Promise<{ found: boolean; qr_token?: string; expired?: boolean; unavailable?: boolean }> {
  const supabase = createClient();
  if (!supabase) return { found: false };
  const { data, error } = await supabase.rpc("get_qr_match_by_short_code", {
    p_short_code: shortCode.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  return data as { found: boolean; qr_token?: string; expired?: boolean; unavailable?: boolean };
}

export function formatGameName(slug: string): string {
  return QR_GAMES.find((g) => g.slug === slug)?.name ?? slug.replace(/-/g, " ");
}
