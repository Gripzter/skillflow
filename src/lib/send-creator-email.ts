import { createAdminClient } from "@/lib/supabase-admin";

type CreatorEmailType = "application_received" | "approved";

type SendCreatorEmailInput = {
  type: CreatorEmailType;
  to: string;
  creatorName?: string;
  gameName?: string;
};

export async function sendCreatorEmail(input: SendCreatorEmailInput): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("[sendCreatorEmail] Missing Supabase env vars");
    return false;
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-creator-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[sendCreatorEmail] Failed:", res.status, text);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[sendCreatorEmail] Error:", err);
    return false;
  }
}

export async function getCreatorEmailByUserId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}
