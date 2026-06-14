import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const ADMIN_OWNER_ID = "ff24466d-ee44-4cfe-9f88-54745ddfc324";
export const SKILLIES_PER_USD = 80;
export const RAKE_RATE = 0.12;
export const CREATOR_RAKE_SHARE = 0.2;
export const SKILLFLOW_RAKE_SHARE = 0.8;

export function skToUsd(sk: number): number {
  return sk / SKILLIES_PER_USD;
}

export function usdToSk(usd: number): number {
  return usd * SKILLIES_PER_USD;
}

export function calcMatchEconomics(stakeSp: number) {
  const potSK = stakeSp * 2;
  const rakeSK = Math.floor(potSK * RAKE_RATE);
  const creatorCutSK = Math.floor(rakeSK * CREATOR_RAKE_SHARE);
  const skillflowNetSK = rakeSK - creatorCutSK;
  return { potSK, rakeSK, creatorCutSK, skillflowNetSK };
}

export type MatchDisplayStatus =
  | "completed"
  | "in_progress"
  | "voided"
  | "timed_out"
  | "forfeited"
  | "cancelled";

const STALE_MATCH_MS = 10 * 60 * 1000;

export function resolveAdminMatchStatus(m: {
  state?: string | null;
  status?: string | null;
  sdk_phase?: string | null;
  created_at?: string | null;
}): MatchDisplayStatus {
  if (m.status === "voided" || m.state === "voided" || m.sdk_phase === "voided") return "voided";
  if (m.status === "cancelled") return "cancelled";
  if (m.status === "forfeited") return "forfeited";
  if (m.status === "timed_out") return "timed_out";
  if (m.state === "settled" || m.status === "completed") return "completed";

  const createdAt = m.created_at ? new Date(m.created_at).getTime() : Date.now();
  if (Date.now() - createdAt > STALE_MATCH_MS) {
    return "timed_out";
  }
  return "in_progress";
}

export function resolvePlayerLabel(
  playerId: string | null | undefined,
  profileMap: Map<string, string>
): string {
  if (!playerId) return "bot";
  return profileMap.get(playerId) ?? "bot";
}

export function resolveWinnerLabel(
  winnerId: string | null | undefined,
  status: MatchDisplayStatus,
  profileMap: Map<string, string>
): string {
  if (status !== "completed") return "—";
  if (!winnerId) return "bot";
  return profileMap.get(winnerId) ?? "bot";
}

export function matchRakeSK(m: { rake_amount?: number | null; stake_sp?: number | null }) {
  if (m.rake_amount != null && Number(m.rake_amount) >= 0) {
    return Number(m.rake_amount);
  }
  return Math.floor(Number(m.stake_sp ?? 0) * 2 * RAKE_RATE);
}

export function truncateId(id: string, head = 8, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

type AdminContext =
  | { admin: NonNullable<ReturnType<typeof createAdminClient>>; userId: string }
  | { error: NextResponse };

export async function requireAdmin(req: NextRequest): Promise<AdminContext> {
  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: "Service unavailable" }, { status: 503 }) };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);

  if (error || !user || user.id !== ADMIN_OWNER_ID) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { admin, userId: user.id };
}

export function jsonOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
