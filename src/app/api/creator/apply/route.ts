import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { jsonOk } from "@/lib/admin-api";
import { sendCreatorEmail } from "@/lib/send-creator-email";

type ApplyBody = {
  token: string;
  name: string;
  email: string;
  password: string;
  gameName: string;
  gameUrl: string;
  gameDescription: string;
  winCondition: string;
  skillConfirmed: boolean;
  termsAccepted: boolean;
};

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  if (!admin) {
    return jsonOk({ error: "Service unavailable" }, 503);
  }

  const body = (await req.json()) as ApplyBody;

  if (
    !body.token ||
    !body.name?.trim() ||
    !body.email?.trim() ||
    !body.password ||
    !body.gameName?.trim() ||
    !body.gameUrl?.trim() ||
    !body.gameDescription?.trim() ||
    !body.winCondition?.trim()
  ) {
    return jsonOk({ error: "All fields are required." }, 400);
  }

  if (body.password.length < 8) {
    return jsonOk({ error: "Password must be at least 8 characters." }, 400);
  }

  if (body.gameDescription.length > 500) {
    return jsonOk({ error: "Game description must be 500 characters or less." }, 400);
  }

  if (body.winCondition.length > 300) {
    return jsonOk({ error: "Win condition must be 300 characters or less." }, 400);
  }

  if (!body.skillConfirmed || !body.termsAccepted) {
    return jsonOk({ error: "You must confirm skill-based gameplay and accept the terms." }, 400);
  }

  const { data: inviteDetails } = await admin.rpc("get_invite_details", {
    p_token: body.token,
  });

  const invite = inviteDetails as { valid?: boolean; email?: string; reason?: string };
  if (!invite?.valid) {
    return jsonOk({ error: "Invalid or expired invite.", reason: invite?.reason }, 400);
  }

  if (invite.email && invite.email.toLowerCase() !== body.email.trim().toLowerCase()) {
    return jsonOk({ error: "This invite is reserved for a different email address." }, 400);
  }

  const username = body.name.trim().replace(/\s+/g, "_").slice(0, 30);

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: body.email.trim().toLowerCase(),
    password: body.password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: body.name.trim(),
      is_creator: true,
    },
  });

  if (authError || !authData.user) {
    const msg = authError?.message ?? "Failed to create account.";
    if (msg.toLowerCase().includes("already")) {
      return jsonOk({ error: "An account with this email already exists. Try logging in." }, 409);
    }
    return jsonOk({ error: msg }, 400);
  }

  const userId = authData.user.id;

  await admin.from("profiles").upsert({
    id: userId,
    username: `${username}_${userId.slice(0, 4)}`,
  });

  const { error: gameError } = await admin.rpc("create_pending_creator_game", {
    p_creator_id: userId,
    p_invite_token: body.token,
    p_creator_display_name: body.name.trim(),
    p_game_name: body.gameName.trim(),
    p_game_url: body.gameUrl.trim(),
    p_game_description: body.gameDescription.trim(),
    p_win_condition: body.winCondition.trim(),
  });

  if (gameError) {
    await admin.auth.admin.deleteUser(userId);
    return jsonOk({ error: gameError.message }, 400);
  }

  void sendCreatorEmail({
    type: "application_received",
    to: body.email.trim().toLowerCase(),
    creatorName: body.name.trim(),
  });

  return jsonOk({ success: true });
}
