import { NextRequest } from "next/server";
import { jsonOk, requireAdmin } from "@/lib/admin-api";

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const ctx = await requireAdmin(_req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const { data } = await admin
    .from("admin_notes")
    .select("*")
    .eq("target_type", "player")
    .eq("target_id", params.userId)
    .order("created_at", { ascending: false });

  return jsonOk({ notes: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin, userId: adminId } = ctx;

  const body = (await req.json()) as { note?: string };
  if (!body.note?.trim()) return jsonOk({ error: "note required" }, 400);

  const { data, error } = await admin
    .from("admin_notes")
    .insert({
      target_type: "player",
      target_id: params.userId,
      note: body.note.trim(),
      created_by: adminId,
    })
    .select("*")
    .single();

  if (error) return jsonOk({ error: error.message }, 400);
  return jsonOk({ note: data });
}
