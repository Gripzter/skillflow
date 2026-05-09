import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import LandingPage from "@/components/landing";
import ReferralCapture from "@/components/landing/ReferralCapture";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const getFoundersData = unstable_cache(
  async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anonKey) {
        return { remaining: 1000, closed: false };
      }
      const supabase = createSupabaseClient(url, anonKey);

      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .or("rank_tier.eq.platinum,rank_tier.eq.diamond,rank_tier.eq.Platinum,rank_tier.eq.Diamond");

      if (error) {
        return { remaining: 1000, closed: false };
      }

      const qualified = Number(count ?? 0);
      if (qualified > 1000) {
        return { remaining: null, closed: true };
      }
      return { remaining: Math.max(0, 1000 - qualified), closed: false };
    } catch {
      return { remaining: 1000, closed: false };
    }
  },
  ["landing-founders-remaining"],
  { revalidate: 300 }
);

export default async function Home() {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/dashboard");
    }
  }

  const founders = await getFoundersData();

  return (
    <>
      <ReferralCapture />
      <LandingPage foundersRemaining={founders.remaining} foundersClosed={founders.closed} />
    </>
  );
}
