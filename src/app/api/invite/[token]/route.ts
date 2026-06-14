import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { jsonOk } from "@/lib/admin-api";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const admin = createAdminClient();
  if (!admin) {
    return jsonOk({ error: "Service unavailable" }, 503);
  }

  const token = params.token;
  const { data, error } = await admin.rpc("get_invite_details", { p_token: token });

  if (error) {
    return jsonOk({ valid: false, reason: "error" }, 400);
  }

  return jsonOk(data);
}
