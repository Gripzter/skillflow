import { createClient as createSharedClient } from "@/lib/supabase";

export function createClient() {
  return createSharedClient();
}
