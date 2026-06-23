import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export async function createNotification(
  supabase: SupabaseClient,
  input: { userId: string; type: string; message: string }
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    message: input.message,
  });
  if (error) {
    console.error("[notifications] insert failed:", error.message);
  }
}

export async function createNotificationAdmin(input: {
  userId: string;
  type: string;
  message: string;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await createNotification(admin, input);
}

export async function createNotificationsForAllUsers(input: {
  type: string;
  message: string;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const { data: profiles, error } = await admin.from("profiles").select("id");
  if (error || !profiles?.length) return;

  const rows = profiles.map((p) => ({
    user_id: p.id as string,
    type: input.type,
    message: input.message,
  }));

  const { error: insertError } = await admin.from("notifications").insert(rows);
  if (insertError) {
    console.error("[notifications] bulk insert failed:", insertError.message);
  }
}

export function formatNotificationRelativeTime(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
