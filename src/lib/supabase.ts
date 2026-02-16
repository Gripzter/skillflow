import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let warned = false;

export function createClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (!warned && typeof console !== "undefined") {
      warned = true;
      console.warn(
        "[SkillFlow] Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing. Auth will be disabled. Add them to .env.local to enable."
      );
    }
    return null;
  }

  return createBrowserClient(url, anonKey);
}
