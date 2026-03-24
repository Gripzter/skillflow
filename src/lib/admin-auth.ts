import { createClient } from "@/lib/supabase";

export const ADMIN_EMAIL = "aras.axmas@gmail.com";

export async function checkAdminAccess(): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email === ADMIN_EMAIL;
}

export async function getAdminSession(): Promise<{ user: { id: string; email: string } } | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || session.user.email !== ADMIN_EMAIL) return null;
  return session as { user: { id: string; email: string } };
}

export async function adminLogout(): Promise<void> {
  const supabase = createClient();
  if (supabase) await supabase.auth.signOut();
}
