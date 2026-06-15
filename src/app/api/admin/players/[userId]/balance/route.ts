import { NextRequest } from "next/server";
import { jsonOk, requireAdmin } from "@/lib/admin-api";

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin, userId: adminId } = ctx;

  const body = (await req.json()) as { amountSK?: number; reason?: string };
  if (body.amountSK === undefined || !body.reason?.trim()) {
    return jsonOk({ error: "amountSK and reason required" }, 400);
  }

  const { data, error } = await admin.rpc("admin_adjust_balance", {
    p_admin_id: adminId,
    p_user_id: params.userId,
    p_amount_sk: Math.round(body.amountSK),
    p_reason: body.reason.trim(),
  });

  if (error) return jsonOk({ error: error.message }, 400);
  return jsonOk(data);
}
