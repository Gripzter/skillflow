"use client";

import { useEffect, useState } from "react";
import CreatorSidebar, { CreatorLoadingSpinner } from "@/components/creator/CreatorSidebar";
import { useCreatorProfile } from "@/hooks/useCreatorData";
import { createClient } from "@/lib/supabase";

export default function CreatorPortalLayout({ children }: { children: React.ReactNode }) {
  const [authChecked, setAuthChecked] = useState(false);
  const { profile, loading } = useCreatorProfile();

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      const supabase = createClient();
      if (!supabase) {
        window.location.href = "/login";
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setAuthChecked(true);
    }

    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || !authChecked) return;
    if (!profile) {
      window.location.href = "/creator/not-found";
    }
  }, [loading, profile, authChecked]);

  if (!authChecked || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
        <CreatorLoadingSpinner />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
        <CreatorLoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0E12] text-[#F0F0F4]">
      <CreatorSidebar gameName={profile.game_name} status={profile.status} />
      <main className="min-h-screen pt-14 lg:ml-60 lg:pt-0">
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
