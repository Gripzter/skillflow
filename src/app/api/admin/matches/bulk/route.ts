import { NextRequest } from "next/server";
import { jsonOk, requireAdmin } from "@/lib/admin-api";

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as { matchIds?: string[]; action?: string };
  if (body.action !== "void" || !body.matchIds?.length) {
    return jsonOk({ error: "matchIds and action=void required" }, 400);
  }

  let voided = 0;
  for (const id of body.matchIds) {
    const { error } = await admin.rpc("void_match", {
      p_match_id: id,
      p_reason: "admin_bulk_void",
    });
    if (!error) {
      await admin.from("matches").update({ status: "voided" }).eq("id", id);
      voided++;
    }
  }

  return jsonOk({ voided });
}
