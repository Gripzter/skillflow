import { NextRequest } from "next/server";
import { jsonOk, requireAdmin } from "@/lib/admin-api";
import { forceRotateTodaysChallenges } from "@/lib/challengeRotation";

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;

  const slots = await forceRotateTodaysChallenges();
  return jsonOk({ slots, challengeDate: new Date().toISOString().slice(0, 10) });
}
