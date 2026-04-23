import { createClient } from "@/lib/supabase";

const WAITLIST_TABLE_CANDIDATES = ["waitlist", "founders_waitlist", "founders_program_signups"] as const;

function isMissingTableError(error: { code?: string } | null): boolean {
  return error?.code === "42P01";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function resolveWaitlistTableName() {
  const supabase = createClient();
  if (!supabase) return { supabase, tableName: null as null | string };

  for (const tableName of WAITLIST_TABLE_CANDIDATES) {
    const { error } = await supabase.from(tableName).select("id").limit(1);
    if (!error || !isMissingTableError(error)) {
      return { supabase, tableName };
    }
  }

  return { supabase, tableName: null as null | string };
}

export async function markFoundersPromptShown(userId: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("profiles")
    .update({ founders_prompt_shown: true })
    .eq("id", userId);
  return !error;
}

export async function updateMarketingOptIn(userId: string, marketingOptIn: boolean): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("profiles")
    .update({ marketing_opt_in: marketingOptIn })
    .eq("id", userId);
  return !error;
}

export async function submitFoundersProgramSignup(params: {
  email: string;
  userId: string;
}): Promise<{ success: boolean; alreadyOnList: boolean; message: string }> {
  const normalizedEmail = normalizeEmail(params.email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return { success: false, alreadyOnList: false, message: "Enter a valid email address." };
  }

  const { supabase, tableName } = await resolveWaitlistTableName();
  if (!supabase || !tableName) {
    return {
      success: false,
      alreadyOnList: false,
      message: "Founders signup is not configured yet. Please try again soon.",
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from(tableName)
    .select("id, user_id")
    .eq("email", normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { success: false, alreadyOnList: false, message: "Could not check existing signup. Please try again." };
  }

  if (existing) {
    if (!existing.user_id && params.userId) {
      await supabase
        .from(tableName)
        .update({ user_id: params.userId })
        .eq("id", existing.id);
    }
    return { success: true, alreadyOnList: true, message: "You're already on the list!" };
  }

  const { error: insertError } = await supabase.from(tableName).insert({
    email: normalizedEmail,
    user_id: params.userId,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { success: true, alreadyOnList: true, message: "You're already on the list!" };
    }
    return { success: false, alreadyOnList: false, message: "Could not join the Founders Program right now." };
  }

  return { success: true, alreadyOnList: false, message: "You're in! Welcome to the Founders Program." };
}
