import { createClient } from "@/lib/supabase";
import { clearClientSessionState } from "@/lib/client-session";
import { ADMIN_OWNER_ID } from "@/lib/admin-api";

export const ADMIN_OWNER_USER_ID = ADMIN_OWNER_ID;

export async function checkAdminAccess(): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id === ADMIN_OWNER_USER_ID;
}

export async function getAdminSession(): Promise<{ user: { id: string; email: string } } | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || session.user.id !== ADMIN_OWNER_USER_ID) return null;
  return session as { user: { id: string; email: string } };
}

export async function adminLogout(): Promise<void> {
  const supabase = createClient();
  try {
    if (supabase) {
      await supabase.auth.signOut();
    }
  } finally {
    clearClientSessionState();
  }
}
