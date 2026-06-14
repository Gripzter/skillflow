import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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

  const { data: inviteRow, error: inviteError } = await admin
    .from("creator_invites")
    .select("email, status, expires_at")
    .eq("token", body.token)
    .maybeSingle();

  if (inviteError || !inviteRow) {
    return jsonOk({ error: "Invalid or expired invite." }, 400);
  }

  if (inviteRow.status !== "pending") {
    return jsonOk({ error: "Invalid or expired invite." }, 400);
  }

  if (new Date(inviteRow.expires_at as string) < new Date()) {
    return jsonOk({ error: "Invalid or expired invite." }, 400);
  }

  if (inviteRow.email != null && String(inviteRow.email).trim() !== "") {
    if (String(inviteRow.email).trim().toLowerCase() !== body.email.trim().toLowerCase()) {
      return jsonOk({ error: "this invite was issued for a different email address" }, 400);
    }
  }

  const username = body.name.trim().replace(/\s+/g, "_").slice(0, 30);
  const email = body.email.trim().toLowerCase();

  const anon = createAnonClient();
  if (!anon) {
    return jsonOk({ error: "Service unavailable" }, 503);
  }

  const { data: signInData } = await anon.auth.signInWithPassword({
    email,
    password: body.password,
  });

  let userId: string;
  let createdNewUser = false;

  if (signInData.user) {
    userId = signInData.user.id;
  } else {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: body.name.trim(),
        is_creator: true,
      },
    });

    if (authError || !authData.user) {
      return jsonOk(
        {
          error:
            "Incorrect password. If you already have a SkillFlow account, use your existing password.",
        },
        401
      );
    }

    userId = authData.user.id;
    createdNewUser = true;
  }

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
    if (createdNewUser) {
      await admin.auth.admin.deleteUser(userId);
    }
    return jsonOk({ error: gameError.message }, 400);
  }

  void sendCreatorEmail({
    type: "application_received",
    to: email,
    creatorName: body.name.trim(),
  });

  return jsonOk({ success: true });
}
