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
  stake_sk?: number;
  status?: string;
  expires_at?: string;
  host_username?: string;
  host_avatar_url?: string | null;
  match_id?: string | null;
};

export type CreateQRMatchResult = {
  id: string;
  qr_token: string;
  game: string;
  stake_sk: number;
  expires_at: string;
};

export type AcceptQRMatchResult = {
  match_id: string;
  qr_match_id: string;
  game: string;
  stake_sk: number;
  host_user_id: string;
  opponent_is_anonymous: boolean;
  anonymous_guest_id?: string;
};

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

export async function createQRMatch(game: string, stakeSk: number): Promise<CreateQRMatchResult> {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("create_qr_match", {
    p_game: game,
    p_stake_sk: stakeSk,
  });
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

export function formatGameName(slug: string): string {
  return QR_GAMES.find((g) => g.slug === slug)?.name ?? slug.replace(/-/g, " ");
}
