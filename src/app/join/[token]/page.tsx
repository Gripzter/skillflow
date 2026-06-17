import { createClient } from "@supabase/supabase-js";
import JoinQRMatchClient from "./JoinQRMatchClient";
import type { QRMatchPublic } from "@/lib/qr-match";

export const dynamic = "force-dynamic";

type Props = {
  params: { token: string };
};

async function fetchMatch(token: string): Promise<QRMatchPublic> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { found: false };

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("get_qr_match_by_token", { p_token: token });
  if (error) return { found: false };
  return data as QRMatchPublic;
}

export default async function JoinPage({ params }: Props) {
  const initialMatch = await fetchMatch(params.token);
  return <JoinQRMatchClient token={params.token} initialMatch={initialMatch} />;
}
