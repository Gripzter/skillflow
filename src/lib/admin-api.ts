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
